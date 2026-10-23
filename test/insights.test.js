import assert from 'node:assert/strict'
import { jobsToCsv, jobsToJson, listJobTasks, searchJobs, summarizeJobs } from '../scripts/insights.js'

const jobs = [
  { jobId: 1, tenantId: '0xtenant', payer: '0xpayer', provider: '0xprovider', reviewer: '0xreviewer', termsHash: '0xaa', evidenceHash: '0x', amountWei: '1000', deadline: 2000, state: 1 },
  { jobId: 2, tenantId: '0xtenant', payer: '0xpayer', provider: '0xprovider', reviewer: '0xreviewer', termsHash: '0xbb', evidenceHash: '0xcc', amountWei: '2000', deadline: 2000, state: 'EvidenceSubmitted' },
  { jobId: 3, tenantId: '0xother', payer: '0xpayer', provider: '0xprovider', reviewer: '0xreviewer', termsHash: '0xdd', evidenceHash: '0x', amountWei: '3000', deadline: 500, state: 'Funded' },
  { jobId: 4, tenantId: '0xother', payer: '0xpayer', provider: '0xprovider', reviewer: '0xreviewer', termsHash: '0xee', evidenceHash: '0xff', amountWei: '4000', deadline: 2000, state: 'Released' },
]

describe('escrow insights (offline CLI helpers)', function () {
  it('searches jobs and derives only actionable tasks', function () {
    assert.equal(searchJobs(jobs, '0XPROVIDER').length, 4)
    assert.equal(searchJobs(jobs, '', { state: 'Funded' }).length, 2)
    assert.deepEqual(listJobTasks(jobs, 1000).map((t) => `${t.jobId}:${t.kind}`), ['1:submit-evidence', '2:review-evidence', '3:refund-expired'])
  })

  it('exports jobs as CSV and JSON', function () {
    assert.match(jobsToCsv(jobs), /"2",.*EvidenceSubmitted/)
    assert.match(jobsToJson(jobs), /"jobId": "4"/)
  })

  it('AI summary uses labelled deterministic fallback without a key and provider only with one', async function () {
    const fallback = await summarizeJobs(jobs, { apiKey: '', nowSeconds: 1000 })
    assert.equal(fallback.provider, 'deterministic-fallback')
    assert.equal(fallback.facts.escrowedWei, '6000')
    let seenUrl = ''
    const provided = await summarizeJobs(jobs, { apiKey: 'test-key', nowSeconds: 1000, fetcher: async (url) => { seenUrl = url; return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'Provider summary.' } }] }) } } })
    assert.equal(provided.provider, 'openai-compatible')
    assert.match(seenUrl, /\/chat\/completions$/)
  })
})
