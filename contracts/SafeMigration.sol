// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title SafeMigration
 * @dev Handles the migration of SGCOIN V1 to V2.
 *      - Burns V1 tokens (sends to Burn Address).
 *      - Pulls V2 tokens from the Owner's wallet (Liquidity Provider).
 *      - Adheres to dynamic/tiered exchange ratios.
 */

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function decimals() external view returns (uint8);
}

contract SafeMigration {
    address public owner;
    IERC20 public v1Token;
    IERC20 public v2Token;
    
    // The address where V1 tokens are sent (Burn Address)
    address public constant BURN_ADDRESS = 0x20756b2667D575Ddde2383f3841D2CD855D5fb6d;

    // The address providing V2 liquidity (The Owner/User)
    address public liquidityProvider;

    bool public isPaused;

    event Migrated(address indexed user, uint256 v1Amount, uint256 v2Amount, string tier);
    event LiquidityProviderUpdated(address indexed newProvider);

    constructor(address _v1Token, address _v2Token) {
        owner = msg.sender;
        liquidityProvider = msg.sender;
        v1Token = IERC20(_v1Token);
        v2Token = IERC20(_v2Token);
        isPaused = false;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    /**
     * @dev Calculates the V2 amount based on a flat 1,000,000:1 ratio.
     *      Matches final tokenomics: 10 Trillion V1 -> 10 Million V2.
     */
    function getV2Amount(uint256 v1Amount) public pure returns (uint256, string memory) {
        // V1 has 9 decimals, V2 has 18 decimals.
        // We want 1,000,000 V1 to equal 1 V2.
        // v2Amount = (v1Amount / 1,000,000) * 1e9 (to adjust decimals from 9 to 18)
        uint256 v2Amount = (v1Amount * 1e9) / 1_000_000;
        return (v2Amount, "Standard");
    }

    /**
     * @dev Main migration function.
     *      User MUST Approve this contract to spend V1.
     *      LiquidityProvider MUST Approve this contract to spend V2.
     */
    function migrate(uint256 v1Amount) external {
        require(!isPaused, "Migration paused");
        require(v1Amount > 0, "Amount must be > 0");

        // 1. Calculate V2 Output
        (uint256 v2Amount, string memory tier) = getV2Amount(v1Amount);
        require(v2Amount > 0, "V2 amount too small");

        // 2. Check Allowances
        require(v1Token.allowance(msg.sender, address(this)) >= v1Amount, "Check V1 Allowance");
        require(v2Token.allowance(liquidityProvider, address(this)) >= v2Amount, "Liquidity Provider needs to Approve Contract");
        require(v2Token.balanceOf(liquidityProvider) >= v2Amount, "Insufficient V2 Liquidity");

        // 3. Transfer V1 from User -> Burn Address
        bool v1Success = v1Token.transferFrom(msg.sender, BURN_ADDRESS, v1Amount);
        require(v1Success, "V1 Transfer failed");

        // 4. Transfer V2 from LiquidityProvider -> User
        bool v2Success = v2Token.transferFrom(liquidityProvider, msg.sender, v2Amount);
        require(v2Success, "V2 Transfer failed");

        emit Migrated(msg.sender, v1Amount, v2Amount, tier);
    }

    /**
     * @dev Update the source wallet for V2 tokens.
     *      The new provider must Approve the contract!
     */
    function setLiquidityProvider(address _provider) external onlyOwner {
        liquidityProvider = _provider;
        emit LiquidityProviderUpdated(_provider);
    }

    function togglePause() external onlyOwner {
        isPaused = !isPaused;
    }
}
