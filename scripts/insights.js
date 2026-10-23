// Read-only insights over MilestoneEscrow job records exported off-chain
// (e.g. from JobCreated events / jobs() calls). Never submits a transaction
// and never participates in a release, refund, or dispute decision.
import { readFileSync } from 'node:fs'

export const JOB_STATES = ['None', 'Funded', 'EvidenceSubmitted', 'Disputed', 'Released', 'Refunded', 'Cancelled']

export function stateName(state) {
  if (typeof state === 'number' || (typeof state === 'string' && /^\d+$/.test(state))) return JOB_STATES[Number(state)] ?? 'Unknown'
  return String(state)
}

export function normalizeJob(job) {
  return { ...job, jobId: String(job.jobId), state: stateName(job.state), amountWei: String(job.amountWei ?? '0'), deadline: Number(job.deadline) }
}

export function searchJobs(jobs, query = '', filters = {}) {
  const needle = String(query).trim().toLowerCase()
  return jobs.map(normalizeJob).filter((job) => {
    if (filters.state && job.state !== filters.state) return false
    if (filters.tenantId && job.tenantId !== filters.tenantId) return false
    if (!needle) return true
    return [job.jobId, job.tenantId, job.payer, job.provider, job.reviewer, job.state, job.termsHash, job.evidenceHash]
      .some((field) => String(field ?? '').toLowerCase().includes(needle))
  })
}

export function listJobTasks(jobs, nowSeconds = Math.floor(Date.now() / 1000)) {
  const tasks = []
  for (const job of jobs.map(normalizeJob)) {
    if (job.state === 'Funded' && nowSeconds > job.deadline) tasks.push({ kind: 'refund-expired', jobId: job.jobId, actor: job.payer, tenantId: job.tenantId })
    else if (job.state === 'Funded') tasks.push({ kind: 'submit-evidence', jobId: job.jobId, actor: job.provider, tenantId: job.tenantId })
    else if (job.state === 'EvidenceSubmitted') tasks.push({ kind: 'review-evidence', jobId: job.jobId, actor: job.reviewer, tenantId: job.tenantId })
    else if (job.state === 'Disputed') tasks.push({ kind: 'resolve-dispute', jobId: job.jobId, actor: job.reviewer, tenantId: job.tenantId })
  }
  return tasks
}

function csvCell(value) { return `"${String(value ?? '').replace(/"/g, '""')}"` }

export function jobsToCsv(jobs) {
  const header = 'job_id,tenant_id,payer,provider,reviewer,amount_wei,deadline,state,terms_hash,evidence_hash'
  const rows = jobs.map(normalizeJob).map((j) => [j.jobId, j.tenantId, j.payer, j.provider, j.reviewer, j.amountWei, j.deadline, j.state, j.termsHash, j.evidenceHash].map(csvCell).join(','))
  return [header, ...rows].join('\n')
}

export function jobsToJson(jobs) { return JSON.stringify(jobs.map(normalizeJob), null, 2) }

export async function summarizeJobs(jobs, options = {}) {
  const normalized = jobs.map(normalizeJob)
  const byState = {}
  for (const job of normalized) byState[job.state] = (byState[job.state] || 0) + 1
  const open = normalized.filter((j) => ['Funded', 'EvidenceSubmitted', 'Disputed'].includes(j.state))
  const facts = {
    jobs: normalized.length,
    openJobs: open.length,
    openTasks: listJobTasks(normalized, options.nowSeconds).length,
    escrowedWei: open.reduce((sum, j) => sum + BigInt(j.amountWei || '0'), 0n).toString(),
    ...Object.fromEntries(Object.entries(byState).map(([k, v]) => [`state_${k}`, v])),
  }
  const fallbackText = `Milestone escrow: ${facts.jobs} job(s), ${facts.openJobs} open, ${facts.openTasks} open task(s), ${facts.escrowedWei} wei escrowed in open jobs.`
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY
  if (!apiKey) return { provider: 'deterministic-fallback', text: fallbackText, facts }
  const fetcher = options.fetcher ?? globalThis.fetch
  const model = options.model ?? process.env.AI_MODEL ?? 'gpt-4o-mini'
  const baseUrl = (options.baseUrl ?? process.env.AI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '')
  const response = await fetcher(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [
      { role: 'system', content: 'Summarize milestone-escrow job facts in one short paragraph. Never approve, release, or refund a job.' },
      { role: 'user', content: JSON.stringify(facts) },
    ] }),
  })
  if (!response.ok) throw new Error(`ai_provider_http_${response.status}`)
  const body = await response.json()
  const text = body.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('ai_provider_empty_response')
  return { provider: 'openai-compatible', model, text, facts }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2]
  if (!file) { console.error('Usage: node scripts/insights.js <jobs.json> [--query text] [--state Funded] [--format csv|json]'); process.exitCode = 2 }
  else {
    const jobs = JSON.parse(readFileSync(file, 'utf8'))
    const arg = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined }
    const format = arg('--format')
    const filtered = searchJobs(jobs, arg('--query') ?? '', { state: arg('--state') })
    if (format === 'csv') process.stdout.write(`${jobsToCsv(filtered)}\n`)
    else if (format === 'json') process.stdout.write(`${jobsToJson(filtered)}\n`)
    else summarizeJobs(filtered).then((summary) => process.stdout.write(`${JSON.stringify({ tasks: listJobTasks(filtered), summary }, null, 2)}\n`))
  }
}
