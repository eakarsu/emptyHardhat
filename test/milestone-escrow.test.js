import { expect } from 'chai'
import { network } from 'hardhat'

const tenant = '0x' + '11'.repeat(32)
const otherTenant = '0x' + '22'.repeat(32)
const terms = '0x' + 'aa'.repeat(32)
const evidence = '0x' + 'bb'.repeat(32)
const reason = '0x' + 'cc'.repeat(32)

describe('MilestoneEscrow', function () {
  async function fixture() {
    const { ethers, networkHelpers } = await network.create()
    const [owner, admin, payer, provider, reviewer, outsider, nextOwner] = await ethers.getSigners()
    const escrow = await ethers.deployContract('MilestoneEscrow')
    await escrow.registerTenant(tenant, admin.address)
    await escrow.connect(admin).setMemberRole(tenant, payer.address, 1)
    await escrow.connect(admin).setMemberRole(tenant, provider.address, 2)
    await escrow.connect(admin).setMemberRole(tenant, reviewer.address, 3)
    const deadline = BigInt((await networkHelpers.time.latest()) + 3600)
    return { ethers, networkHelpers, escrow, owner, admin, payer, provider, reviewer, outsider, nextOwner, deadline }
  }
  async function create(context, value = 1000n) {
    await context.escrow.connect(context.payer).createJob(tenant, context.provider.address, context.reviewer.address, terms, context.deadline, { value })
    return 1n
  }

  it('registers tenants and roles only through explicit administrators', async function () { const c = await fixture(); await expect(c.escrow.connect(c.outsider).registerTenant(otherTenant, c.outsider.address)).to.be.revertedWithCustomError(c.escrow, 'Unauthorized'); await expect(c.escrow.connect(c.outsider).setMemberRole(tenant, c.outsider.address, 1)).to.be.revertedWithCustomError(c.escrow, 'Unauthorized') })
  it('uses two-step platform ownership transfer', async function () { const c = await fixture(); await c.escrow.proposePlatformOwner(c.nextOwner.address); await expect(c.escrow.connect(c.outsider).acceptPlatformOwnership()).to.be.revertedWithCustomError(c.escrow, 'Unauthorized'); await c.escrow.connect(c.nextOwner).acceptPlatformOwnership(); expect(await c.escrow.platformOwner()).to.equal(c.nextOwner.address) })
  it('uses two-step tenant administration recovery', async function () { const c = await fixture(); await c.escrow.connect(c.admin).proposeTenantAdmin(tenant, c.nextOwner.address); await expect(c.escrow.connect(c.outsider).acceptTenantAdmin(tenant)).to.be.revertedWithCustomError(c.escrow, 'Unauthorized'); await c.escrow.connect(c.nextOwner).acceptTenantAdmin(tenant); expect(await c.escrow.tenantAdmin(tenant)).to.equal(c.nextOwner.address) })
  it('creates exact funded jobs only for tenant-scoped distinct roles', async function () { const c = await fixture(); await expect(c.escrow.connect(c.payer).createJob(tenant, c.provider.address, c.reviewer.address, terms, c.deadline, { value: 1000n })).to.emit(c.escrow, 'JobCreated'); expect((await c.escrow.jobs(1)).amountWei).to.equal(1000n); await expect(c.escrow.connect(c.outsider).createJob(tenant, c.provider.address, c.reviewer.address, terms, c.deadline, { value: 1n })).to.be.revertedWithCustomError(c.escrow, 'Unauthorized') })
  it('rejects zero value, empty terms, invalid deadlines and same-party review', async function () { const c = await fixture(); await expect(c.escrow.connect(c.payer).createJob(tenant, c.provider.address, c.reviewer.address, terms, c.deadline)).to.be.revertedWithCustomError(c.escrow, 'InvalidInput'); await expect(c.escrow.connect(c.payer).createJob(tenant, c.provider.address, c.reviewer.address, '0x' + '00'.repeat(32), c.deadline, { value: 1n })).to.be.revertedWithCustomError(c.escrow, 'InvalidInput'); await expect(c.escrow.connect(c.payer).createJob(tenant, c.provider.address, c.reviewer.address, terms, 1n, { value: 1n })).to.be.revertedWithCustomError(c.escrow, 'InvalidInput'); await expect(c.escrow.connect(c.payer).createJob(tenant, c.provider.address, c.payer.address, terms, c.deadline, { value: 1n })).to.be.revertedWithCustomError(c.escrow, 'Unauthorized') })
  it('binds evidence and release to provider and independent reviewer', async function () { const c = await fixture(); const id = await create(c); await expect(c.escrow.connect(c.payer).submitEvidence(id, evidence)).to.be.revertedWithCustomError(c.escrow, 'Unauthorized'); await c.escrow.connect(c.provider).submitEvidence(id, evidence); await expect(c.escrow.connect(c.payer).approveEvidence(id)).to.be.revertedWithCustomError(c.escrow, 'Unauthorized'); await expect(c.escrow.connect(c.reviewer).approveEvidence(id)).to.emit(c.escrow, 'JobReleased'); expect(await c.escrow.pendingWithdrawals(c.provider.address)).to.equal(1000n) })
  it('uses pull payments and prevents duplicate withdrawal', async function () { const c = await fixture(); await create(c); await c.escrow.connect(c.provider).submitEvidence(1, evidence); await c.escrow.connect(c.reviewer).approveEvidence(1); await expect(c.escrow.connect(c.provider).withdraw()).to.emit(c.escrow, 'Withdrawal'); await expect(c.escrow.connect(c.provider).withdraw()).to.be.revertedWithCustomError(c.escrow, 'InvalidState') })
  it('allows payer cancellation only before evidence', async function () { const c = await fixture(); await create(c); await c.escrow.connect(c.payer).cancelFunded(1); expect((await c.escrow.jobs(1)).state).to.equal(6n); expect(await c.escrow.pendingWithdrawals(c.payer.address)).to.equal(1000n); await expect(c.escrow.connect(c.payer).cancelFunded(1)).to.be.revertedWithCustomError(c.escrow, 'InvalidState') })
  it('refunds expired unsubmitted jobs but not early claims', async function () { const c = await fixture(); await create(c); await expect(c.escrow.connect(c.payer).refundExpired(1)).to.be.revertedWithCustomError(c.escrow, 'InvalidState'); await c.networkHelpers.time.increaseTo(c.deadline + 1n); await expect(c.escrow.connect(c.payer).refundExpired(1)).to.emit(c.escrow, 'JobRefunded'); expect((await c.escrow.jobs(1)).state).to.equal(5n) })
  it('lets the independent reviewer resolve a dispute to refund', async function () { const c = await fixture(); await create(c); await c.escrow.connect(c.provider).submitEvidence(1, evidence); await c.escrow.connect(c.payer).dispute(1, reason); await expect(c.escrow.connect(c.provider).resolveDispute(1, false)).to.be.revertedWithCustomError(c.escrow, 'Unauthorized'); await c.escrow.connect(c.reviewer).resolveDispute(1, false); expect(await c.escrow.pendingWithdrawals(c.payer.address)).to.equal(1000n); expect((await c.escrow.jobs(1)).state).to.equal(5n) })
  it('lets the independent reviewer resolve a dispute to provider', async function () { const c = await fixture(); await create(c); await c.escrow.connect(c.provider).submitEvidence(1, evidence); await c.escrow.connect(c.provider).dispute(1, reason); await c.escrow.connect(c.reviewer).resolveDispute(1, true); expect(await c.escrow.pendingWithdrawals(c.provider.address)).to.equal(1000n); expect((await c.escrow.jobs(1)).state).to.equal(4n) })
  it('revoked roles fail closed before evidence or approval', async function () { const c = await fixture(); await create(c); await c.escrow.connect(c.admin).setMemberRole(tenant, c.provider.address, 0); await expect(c.escrow.connect(c.provider).submitEvidence(1, evidence)).to.be.revertedWithCustomError(c.escrow, 'Unauthorized') })
})
