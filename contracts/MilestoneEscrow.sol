// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.36;

/// @notice Tenant-scoped, evidence-bound escrow. Tenant identifiers, hashes,
/// addresses, amounts, and events are public; never put personal data on-chain.
contract MilestoneEscrow {
    enum Role { None, Payer, Provider, Reviewer }
    enum State { None, Funded, EvidenceSubmitted, Disputed, Released, Refunded, Cancelled }

    struct Job {
        bytes32 tenantId;
        address payer;
        address provider;
        address reviewer;
        bytes32 termsHash;
        bytes32 evidenceHash;
        uint128 amountWei;
        uint64 deadline;
        State state;
    }

    uint256 public constant MAX_JOB_VALUE = 1_000_000 ether;
    uint64 public constant MAX_DEADLINE_WINDOW = 365 days;
    address public platformOwner;
    address public pendingPlatformOwner;
    uint256 public nextJobId = 1;
    bool private withdrawing;

    mapping(bytes32 tenantId => address admin) public tenantAdmin;
    mapping(bytes32 tenantId => address proposedAdmin) public pendingTenantAdmin;
    mapping(bytes32 tenantId => mapping(address account => Role role)) public tenantRole;
    mapping(uint256 jobId => Job job) public jobs;
    mapping(address beneficiary => uint256 amountWei) public pendingWithdrawals;

    event PlatformOwnershipProposed(address indexed currentOwner, address indexed proposedOwner);
    event PlatformOwnershipAccepted(address indexed previousOwner, address indexed newOwner);
    event TenantRegistered(bytes32 indexed tenantId, address indexed admin);
    event TenantAdminProposed(bytes32 indexed tenantId, address indexed currentAdmin, address indexed proposedAdmin);
    event TenantAdminAccepted(bytes32 indexed tenantId, address indexed previousAdmin, address indexed newAdmin);
    event MemberRoleSet(bytes32 indexed tenantId, address indexed account, Role role, address indexed actor);
    event JobCreated(uint256 indexed jobId, bytes32 indexed tenantId, address indexed payer, address provider, address reviewer, uint256 amountWei, bytes32 termsHash, uint64 deadline);
    event EvidenceSubmitted(uint256 indexed jobId, bytes32 indexed tenantId, bytes32 evidenceHash, address indexed provider);
    event JobDisputed(uint256 indexed jobId, bytes32 indexed tenantId, address indexed actor, bytes32 reasonHash);
    event JobReleased(uint256 indexed jobId, bytes32 indexed tenantId, address indexed provider, uint256 amountWei, address reviewer);
    event JobRefunded(uint256 indexed jobId, bytes32 indexed tenantId, address indexed payer, uint256 amountWei, address actor);
    event JobCancelled(uint256 indexed jobId, bytes32 indexed tenantId, address indexed payer, uint256 amountWei);
    event Withdrawal(address indexed beneficiary, uint256 amountWei);

    error Unauthorized();
    error InvalidInput();
    error InvalidState();
    error TransferFailed();
    error Reentrancy();

    constructor() { platformOwner = msg.sender; }

    modifier onlyPlatformOwner() { if (msg.sender != platformOwner) revert Unauthorized(); _; }
    modifier onlyTenantAdmin(bytes32 tenantId) { if (msg.sender != tenantAdmin[tenantId]) revert Unauthorized(); _; }

    function proposePlatformOwner(address proposed) external onlyPlatformOwner {
        if (proposed == address(0) || proposed == platformOwner) revert InvalidInput();
        pendingPlatformOwner = proposed; emit PlatformOwnershipProposed(platformOwner, proposed);
    }

    function acceptPlatformOwnership() external {
        if (msg.sender != pendingPlatformOwner) revert Unauthorized();
        address previous = platformOwner; platformOwner = msg.sender; pendingPlatformOwner = address(0);
        emit PlatformOwnershipAccepted(previous, msg.sender);
    }

    function registerTenant(bytes32 tenantId, address admin) external onlyPlatformOwner {
        if (tenantId == bytes32(0) || admin == address(0) || tenantAdmin[tenantId] != address(0)) revert InvalidInput();
        tenantAdmin[tenantId] = admin; emit TenantRegistered(tenantId, admin);
    }

    function setMemberRole(bytes32 tenantId, address account, Role role) external onlyTenantAdmin(tenantId) {
        if (account == address(0)) revert InvalidInput();
        tenantRole[tenantId][account] = role; emit MemberRoleSet(tenantId, account, role, msg.sender);
    }

    function proposeTenantAdmin(bytes32 tenantId, address proposed) external onlyTenantAdmin(tenantId) {
        if (proposed == address(0) || proposed == msg.sender) revert InvalidInput();
        pendingTenantAdmin[tenantId] = proposed; emit TenantAdminProposed(tenantId, msg.sender, proposed);
    }

    function acceptTenantAdmin(bytes32 tenantId) external {
        if (msg.sender != pendingTenantAdmin[tenantId]) revert Unauthorized();
        address previous = tenantAdmin[tenantId]; tenantAdmin[tenantId] = msg.sender; delete pendingTenantAdmin[tenantId];
        emit TenantAdminAccepted(tenantId, previous, msg.sender);
    }

    function createJob(bytes32 tenantId, address provider, address reviewer, bytes32 termsHash, uint64 deadline) external payable returns (uint256 jobId) {
        if (tenantRole[tenantId][msg.sender] != Role.Payer || tenantRole[tenantId][provider] != Role.Provider || tenantRole[tenantId][reviewer] != Role.Reviewer) revert Unauthorized();
        if (provider == msg.sender || reviewer == msg.sender || reviewer == provider || termsHash == bytes32(0) || msg.value == 0 || msg.value > MAX_JOB_VALUE) revert InvalidInput();
        if (deadline <= block.timestamp || deadline > block.timestamp + MAX_DEADLINE_WINDOW) revert InvalidInput();
        jobId = nextJobId++;
        jobs[jobId] = Job(tenantId, msg.sender, provider, reviewer, termsHash, bytes32(0), uint128(msg.value), deadline, State.Funded);
        emit JobCreated(jobId, tenantId, msg.sender, provider, reviewer, msg.value, termsHash, deadline);
    }

    function submitEvidence(uint256 jobId, bytes32 evidenceHash) external {
        Job storage job = jobs[jobId];
        if (job.state != State.Funded) revert InvalidState();
        if (msg.sender != job.provider || tenantRole[job.tenantId][msg.sender] != Role.Provider) revert Unauthorized();
        if (evidenceHash == bytes32(0) || block.timestamp > job.deadline) revert InvalidInput();
        job.evidenceHash = evidenceHash; job.state = State.EvidenceSubmitted;
        emit EvidenceSubmitted(jobId, job.tenantId, evidenceHash, msg.sender);
    }

    function approveEvidence(uint256 jobId) external {
        Job storage job = jobs[jobId];
        if (job.state != State.EvidenceSubmitted) revert InvalidState();
        if (msg.sender != job.reviewer || tenantRole[job.tenantId][msg.sender] != Role.Reviewer) revert Unauthorized();
        job.state = State.Released; pendingWithdrawals[job.provider] += job.amountWei;
        emit JobReleased(jobId, job.tenantId, job.provider, job.amountWei, msg.sender);
    }

    function dispute(uint256 jobId, bytes32 reasonHash) external {
        Job storage job = jobs[jobId];
        if (job.state != State.EvidenceSubmitted || (msg.sender != job.payer && msg.sender != job.provider) || reasonHash == bytes32(0)) revert InvalidState();
        job.state = State.Disputed; emit JobDisputed(jobId, job.tenantId, msg.sender, reasonHash);
    }

    function resolveDispute(uint256 jobId, bool releaseToProvider) external {
        Job storage job = jobs[jobId];
        if (job.state != State.Disputed) revert InvalidState();
        if (msg.sender != job.reviewer || tenantRole[job.tenantId][msg.sender] != Role.Reviewer) revert Unauthorized();
        if (releaseToProvider) {
            job.state = State.Released; pendingWithdrawals[job.provider] += job.amountWei;
            emit JobReleased(jobId, job.tenantId, job.provider, job.amountWei, msg.sender);
        } else {
            job.state = State.Refunded; pendingWithdrawals[job.payer] += job.amountWei;
            emit JobRefunded(jobId, job.tenantId, job.payer, job.amountWei, msg.sender);
        }
    }

    function cancelFunded(uint256 jobId) external {
        Job storage job = jobs[jobId];
        if (job.state != State.Funded) revert InvalidState();
        if (msg.sender != job.payer) revert Unauthorized();
        job.state = State.Cancelled; pendingWithdrawals[job.payer] += job.amountWei;
        emit JobCancelled(jobId, job.tenantId, job.payer, job.amountWei);
    }

    function refundExpired(uint256 jobId) external {
        Job storage job = jobs[jobId];
        if (job.state != State.Funded || block.timestamp <= job.deadline) revert InvalidState();
        if (msg.sender != job.payer) revert Unauthorized();
        job.state = State.Refunded; pendingWithdrawals[job.payer] += job.amountWei;
        emit JobRefunded(jobId, job.tenantId, job.payer, job.amountWei, msg.sender);
    }

    function withdraw() external {
        if (withdrawing) revert Reentrancy();
        uint256 amount = pendingWithdrawals[msg.sender]; if (amount == 0) revert InvalidState();
        withdrawing = true; pendingWithdrawals[msg.sender] = 0;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
        withdrawing = false; emit Withdrawal(msg.sender, amount);
    }
}
