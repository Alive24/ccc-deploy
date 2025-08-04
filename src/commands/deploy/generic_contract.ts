import { ccc } from "@ckb-ccc/shell";
import { confirm, select, input } from "@inquirer/prompts";
import { Args, Command, Flags } from "@oclif/core";
import chalk from "chalk";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

/**
 * Deploy Generic Contract Command
 * 
 * This command allows you to deploy any compiled RISC-V contract binary to the CKB blockchain
 * with optional Type ID support for upgradeable contracts.
 * 
 * ## Features
 * - Type ID support for upgradeable contracts
 * - Tag-based deployment tracking and upgrades
 * - Multi-network support (testnet/mainnet/devnet)
 * - Automatic deployment record management
 * - Environment variable integration
 * 
 * ## Deployment Output
 * 
 * The command provides deployment information in multiple formats:
 * 
 * 1. **Console Output**: Transaction hash, data hash, Type ID details, and deployment tag
 * 
 * 2. **Centralized deployments.json**: Tracks current deployments and complete history
 *    - Contract types are derived from filename using camelCase conversion
 *    - Examples: `my-contract` → `myContract`, `protocol-type` → `protocolType`
 * 
 * ## Tags and Upgrades
 * 
 * Tags provide deployment tracking and enable contract upgrades:
 * 
 * - **Auto-generated tags**: Format `vYYYYMMDD-HHMM` based on current timestamp
 * - **Custom tags**: Use `--tag` flag for semantic versioning or environment tags
 * - **Upgrades**: Use `--upgradeFrom` to upgrade from a specific tag, or `--upgrade` for interactive mode
 * 
 * ## Type ID
 * 
 * Type ID enables contract upgrades while maintaining the same script hash:
 * 
 * - Deploy with Type ID for upgradeable contracts
 * - Reference via data hash (immutable) or Type ID (upgradeable)
 * - Upgrades maintain the same Type ID for compatibility
 * 
 * ## Prerequisites
 * 
 * 1. Compiled contract binary (RISC-V format)
 * 2. `.env` file with `WALLET_PRIVATE_KEY` or use `--privateKey` flag
 * 3. Optional: `CKB_RPC_URL` in `.env` for custom RPC endpoint
 * 
 */
export default class GenericContract extends Command {
  static description =
    "Deploy a generic contract to CKB blockchain. Supports any compiled RISC-V contract binary with optional Type ID for upgrades.";

  static examples = [
    "# Deploy a contract with Type ID (upgradeable)",
    "ccc-deploy deploy generic-contract ./build/release/my-contract",
    "",
    "# Deploy without Type ID (non-upgradeable)",
    "ccc-deploy deploy generic-contract ./build/release/my-contract --no-typeId",
    "",
    "# Deploy with specific tag for version tracking",
    "ccc-deploy deploy generic-contract ./build/release/my-contract --tag=v1.0.0",
    "",
    "# Upgrade existing contract from v1.0.0 to v2.0.0",
    "ccc-deploy deploy generic-contract ./build/release/my-contract-v2 --upgradeFrom=v1.0.0 --tag=v2.0.0",
    "",
    "# Interactive upgrade mode - select from existing deployments",
    "ccc-deploy deploy generic-contract ./build/release/my-contract-v2 --upgrade",
    "",
    "# Deploy to mainnet with specific private key",
    "ccc-deploy deploy generic-contract ./build/release/my-contract --network=mainnet --privateKey=0x...",
    "",
  ];

  static args = {
    contractPath: Args.string({
      description: "Path to the compiled contract binary",
      required: true,
    }),
  };

  static flags = {
    privateKey: Flags.string({
      description:
        "Private key to sign the deployment transaction. Will use WALLET_PRIVATE_KEY from .env by default.",
      required: false,
    }),
    network: Flags.string({
      description: "Network to deploy to",
      required: false,
      options: ["testnet", "mainnet", "devnet"],
      default: "testnet",
    }),
    typeId: Flags.boolean({
      description: "Deploy with Type ID (allows contract upgrades)",
      default: true,
    }),
    type: Flags.string({
      description: "Type script for the deployed cell (as JSON). Overrides --typeId flag",
      required: false,
    }),
    lock: Flags.string({
      description: "Lock script for the deployed cell (as JSON). Defaults to deployer's lock",
      required: false,
    }),
    tag: Flags.string({
      description: "Deployment tag for tracking and upgrades. Auto-generated if not provided",
      required: false,
    }),
    upgradeFrom: Flags.string({
      description: "Tag of existing deployment to upgrade from. Requires Type ID",
      required: false,
    }),
    upgrade: Flags.boolean({
      description: "Interactive upgrade mode - select from existing deployments",
      required: false,
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(GenericContract);

    // Load environment variables
    dotenv.config();

    // Check if .env exists
    if (!fs.existsSync(".env") && !flags.privateKey) {
      this.log(chalk.yellow("No .env file found and no private key provided"));
      this.error("Please create a .env file with WALLET_PRIVATE_KEY or provide --privateKey flag");
    }

    // Verify contract binary exists
    if (!fs.existsSync(args.contractPath)) {
      this.error(`Contract binary not found at: ${args.contractPath}`);
    }

    // Validate upgrade flags
    if (flags.upgradeFrom && !flags.typeId) {
      this.error("--upgradeFrom requires Type ID deployment (remove --no-typeId flag)");
    }
    
    if (flags.upgrade && !flags.typeId) {
      this.error("--upgrade requires Type ID deployment (remove --no-typeId flag)");
    }
    
    if (flags.upgrade && flags.upgradeFrom) {
      this.error("Cannot use both --upgrade and --upgradeFrom flags together");
    }

    // Setup network client
    const network = flags.network;
    let client: ccc.Client;
    
    if (network === "testnet") {
      client = new ccc.ClientPublicTestnet({
        url: process.env.CKB_RPC_URL,
      });
    } else if (network === "mainnet") {
      client = new ccc.ClientPublicMainnet({
        url: process.env.CKB_RPC_URL,
      });
    } else if (network === "devnet") {
      const devnetUrl = process.env.CKB_RPC_URL || "http://localhost:8114";
      // For devnet, we use testnet client with custom URL
      client = new ccc.ClientPublicTestnet({ url: devnetUrl });
    } else {
      this.error("Invalid network");
    }

    // Setup signer
    const privateKey = flags.privateKey ?? process.env.WALLET_PRIVATE_KEY;
    if (!privateKey) {
      this.error("Private key is required");
    }

    const signer = new ccc.SignerCkbPrivateKey(client, privateKey);
    const deployerAddress = await signer.getRecommendedAddress();
    const deployerLock = (await signer.getRecommendedAddressObj()).script;
    const contractName = path.basename(args.contractPath);

    // Handle interactive upgrade mode
    let upgradeFromTag = flags.upgradeFrom;
    let deploymentTag = flags.tag;
    let useTypeId = flags.typeId;
    
    if (flags.upgrade) {
      const upgradeInfo = await this.interactiveUpgradeMode(contractName, network);
      if (!upgradeInfo) {
        this.log(chalk.yellow("Upgrade cancelled"));
        return;
      }
      upgradeFromTag = upgradeInfo.fromTag;
      deploymentTag = upgradeInfo.toTag || deploymentTag;
    } else if (!flags.upgradeFrom && !flags.type) {
      // Interactive mode for new deployments (not upgrades and no custom type script)
      const deploymentConfig = await this.interactiveDeploymentMode(contractName, flags.typeId, flags.tag);
      if (!deploymentConfig) {
        this.log(chalk.yellow("Deployment cancelled"));
        return;
      }
      useTypeId = deploymentConfig.useTypeId;
      deploymentTag = deploymentConfig.tag;
    }
    
    // Generate tag if not provided
    if (!deploymentTag) {
      deploymentTag = this.generateDeploymentTag();
    }
    
    // Check for existing deployments if upgrading
    let existingDeployment = null;
    if (useTypeId && upgradeFromTag) {
      existingDeployment = await this.findExistingDeployment(contractName, network, upgradeFromTag);
      if (!existingDeployment) {
        this.error(`No existing deployment found with tag '${upgradeFromTag}' for upgrade`);
      }
    }

    this.log(chalk.blue("Deployment Configuration:"));
    this.log(chalk.gray("═".repeat(50)));
    this.log(`${chalk.cyan("Network:")} ${network}`);
    this.log(`${chalk.cyan("Deployer:")} ${deployerAddress}`);
    this.log(`${chalk.cyan("Contract:")} ${args.contractPath}`);
    this.log(`${chalk.cyan("Type ID:")} ${useTypeId ? "Yes" : "No"}`);
    this.log(`${chalk.cyan("Tag:")} ${deploymentTag}`);
    if (existingDeployment) {
      this.log(`${chalk.cyan("Mode:")} ${chalk.yellow("UPGRADE")} (${upgradeFromTag} → ${deploymentTag})`);
    }
    this.log(chalk.gray("═".repeat(50)));


    // Determine lock script
    let deploymentLock = deployerLock;
    if (flags.lock) {
      try {
        deploymentLock = ccc.Script.from(JSON.parse(flags.lock));
        this.log(chalk.yellow("Using custom lock script"));
      } catch (error) {
        this.error(`Invalid lock script JSON: ${error}`);
      }
    }

    // Confirm deployment
    const contractStats = fs.statSync(args.contractPath);
    
    this.log("\n" + chalk.yellow("Contract Details:"));
    this.log(`${chalk.cyan("Name:")} ${contractName}`);
    this.log(`${chalk.cyan("Size:")} ${(contractStats.size / 1024).toFixed(2)} KB`);

    const proceed = await confirm({
      message: "Proceed with deployment?",
      default: true,
    });

    if (!proceed) {
      this.log(chalk.red("Deployment cancelled"));
      return;
    }

    // Read contract binary
    let contractBinary = fs.readFileSync(args.contractPath);

    try {
      let deployTx: ccc.Transaction;
      let deployedType: ccc.Script | null = null;
      let isUpgrade = false;

      // Check if custom type script is provided
      if (flags.type) {
        try {
          deployedType = ccc.Script.from(JSON.parse(flags.type));
          this.log(chalk.yellow("\nUsing custom type script"));
        } catch (error) {
          this.error(`Invalid type script JSON: ${error}`);
        }
      }

      // Check data hash for upgrades
      if (existingDeployment && useTypeId && !flags.type) {
        const newDataHash = ccc.hashCkb(contractBinary);
        
        if (newDataHash === existingDeployment.dataHash) {
          this.log(chalk.yellow("\n⚠️  Warning: Contract binary is identical to existing deployment"));
          this.log(chalk.gray(`  Existing data hash: ${existingDeployment.dataHash}`));
          this.log(chalk.gray(`  New data hash:      ${newDataHash}`));
          
          // Suggest rebuilding the contract
          this.log(chalk.yellow("\n💡 Tip: The contract may not have been rebuilt since last deployment."));
          this.log(chalk.yellow("   Consider running 'make build' in your contracts directory first."));
          
          const rebuildChoice = await select({
            message: 'What would you like to do?',
            choices: [
              {
                name: 'Rebuild the contract now',
                value: 'rebuild',
                description: 'Run make build and retry deployment (recommended)'
              },
              {
                name: 'Proceed with upgrade anyway',
                value: 'proceed',
                description: 'Use this for testing or configuration changes'
              },
              {
                name: 'Cancel upgrade',
                value: 'cancel',
                description: 'Exit without making changes'
              }
            ]
          });
          
          if (rebuildChoice === 'rebuild') {
            this.log(chalk.blue("\n🔨 Rebuilding contracts..."));
            
            // Check if we're in a contracts directory or need to navigate to it
            const currentDir = process.cwd();
            const contractsDir = fs.existsSync(path.join(currentDir, 'contracts')) 
              ? path.join(currentDir, 'contracts')
              : currentDir.endsWith('contracts') 
                ? currentDir 
                : null;
            
            if (!contractsDir) {
              this.log(chalk.red("Could not find contracts directory"));
              this.log(chalk.yellow("Please navigate to your project root or contracts directory and try again"));
              return;
            }
            
            try {
              // Run make build
              execSync('make build', { 
                cwd: contractsDir,
                stdio: 'inherit' 
              });
              
              this.log(chalk.green("\n✅ Contracts rebuilt successfully!"));
              this.log(chalk.blue("Continuing with deployment...\n"));
              
              // Re-read the contract binary after rebuild
              const rebuiltBinary = fs.readFileSync(args.contractPath);
              const rebuiltDataHash = ccc.hashCkb(rebuiltBinary);
              
              // Check if the hash changed after rebuild
              if (rebuiltDataHash === existingDeployment.dataHash) {
                this.log(chalk.yellow("⚠️  Warning: Contract binary is still identical after rebuild"));
                this.log(chalk.gray("   This might mean no source code changes were made"));
                
                const continueAnyway = await confirm({
                  message: 'Continue with upgrade anyway?',
                  default: false
                });
                
                if (!continueAnyway) {
                  this.log(chalk.red("Upgrade cancelled"));
                  return;
                }
              } else {
                this.log(chalk.green("✅ Contract binary updated successfully"));
                this.log(chalk.gray(`  Old data hash: ${existingDeployment.dataHash}`));
                this.log(chalk.gray(`  New data hash: ${rebuiltDataHash}`));
                
                // Update the contractBinary variable to use the rebuilt version
                contractBinary = rebuiltBinary;
              }
            } catch (error) {
              this.log(chalk.red(`\n❌ Build failed: ${error}`));
              this.log(chalk.yellow("Please fix the build errors and try again"));
              return;
            }
          } else if (rebuildChoice === 'cancel') {
            this.log(chalk.red("Upgrade cancelled"));
            return;
          }
          // If 'proceed', continue with the upgrade
        }
      }

      this.log(chalk.blue(`\n${existingDeployment ? 'Upgrading' : 'Deploying'} contract (${contractBinary.length} bytes)...`));

      if (useTypeId && !flags.type) {
        if (existingDeployment) {
          // Upgrade existing Type ID contract
          isUpgrade = true;
          
          // Find the existing Type ID cell
          const existingTypeScript = ccc.Script.from({
            codeHash: existingDeployment.typeScript.codeHash,
            hashType: existingDeployment.typeScript.hashType,
            args: existingDeployment.typeScript.args,
          });
          
          // Find cells with this type script
          const collector = client.findCellsByType(existingTypeScript, true);
          const collectedCells = [];
          
          for await (const cell of collector) {
            collectedCells.push(cell);
            break; // We only need the first one
          }
          
          if (collectedCells.length === 0) {
            this.error("Could not find existing Type ID cell for upgrade");
          }
          
          const existingCell = collectedCells[0];
          
          // Calculate required capacity for the new contract
          const requiredCapacity = ccc.fixedPointFrom(
            8 + // CKB minimum
            deploymentLock.toBytes().length +
            existingTypeScript.toBytes().length +
            contractBinary.length
          );
          
          // Create upgrade transaction
          deployTx = ccc.Transaction.from({
            inputs: [{
              previousOutput: existingCell.outPoint,
              cellOutput: existingCell.cellOutput,
              outputData: existingCell.outputData,
              since: "0x0"
            }],
            outputs: [
              {
                lock: deploymentLock,
                type: existingTypeScript,
                capacity: requiredCapacity,
              },
            ],
            outputsData: [contractBinary],
          });
          
          deployedType = existingTypeScript;
          await deployTx.completeInputsByCapacity(signer);
          
        } else {
          // Deploy new Type ID contract
          deployTx = ccc.Transaction.from({
            outputs: [
              {
                lock: deploymentLock,
                type: await ccc.Script.fromKnownScript(
                  signer.client,
                  ccc.KnownScript.TypeId,
                  "00".repeat(32),
                ),
              },
            ],
            outputsData: [contractBinary],
          });

          await deployTx.completeInputsAtLeastOne(signer);
          
          if (!deployTx.outputs[0].type) {
            this.error("Failed to create Type ID script");
          }

          // Calculate Type ID
          deployTx.outputs[0].type.args = ccc.hashTypeId(deployTx.inputs[0], 0);
          deployedType = deployTx.outputs[0].type;
        }
        
      } else {
        // Deploy with custom type script or no type script
        deployTx = ccc.Transaction.from({
          outputs: [
            {
              lock: deploymentLock,
              type: deployedType, // Will be null if no type script
            },
          ],
          outputsData: [contractBinary],
        });

        await deployTx.completeInputsByCapacity(signer);
      }

      // Complete transaction with fees
      await deployTx.completeFeeBy(signer, 1000); // 1000 shannon/byte fee

      // Send transaction
      const txHash = await signer.sendTransaction(deployTx);
      
      this.log(chalk.green(isUpgrade ? "\n✅ Contract upgraded successfully!" : "\n✅ Contract deployed successfully!"));
      this.log(chalk.gray("═".repeat(50)));
      
      // Calculate data hash (code hash when hash_type is "data")
      const dataHash = ccc.hashCkb(contractBinary);
      
      // Deployment info
      const deploymentInfo = {
        network,
        deployedAt: new Date().toISOString(),
        transactionHash: txHash,
        contractName,
        contractSize: contractBinary.length,
        dataHash,
        deployerAddress,
        tag: deploymentTag,
        isUpgrade,
        ...(existingDeployment && {
          previousDeployment: {
            transactionHash: existingDeployment.transactionHash,
            index: existingDeployment.index,
            deployedAt: existingDeployment.deployedAt,
            tag: existingDeployment.tag || flags.upgradeFrom,
          },
        }),
        ...(deployedType && {
          typeScript: {
            codeHash: deployedType.codeHash,
            hashType: deployedType.hashType,
            args: deployedType.args,
          },
          // Mark if this is a Type ID deployment
          isTypeId: deployedType.codeHash === '0x00000000000000000000000000000000000000000000000000545950455f4944',
          typeHash: deployedType.hash(),
        }),
      };

      // Display deployment info
      this.log(`${chalk.cyan("Transaction Hash:")} ${txHash}`);
      this.log(`${chalk.cyan("Index: 0")}`);
      this.log(`${chalk.cyan("Tag:")} ${deploymentTag}`);
      
      if (deployedType) {
        if (deploymentInfo.isTypeId) {
          this.log(chalk.yellow("\nDeployed with Type ID (upgradeable):"));
          this.log(`${chalk.cyan("  Type ID Code Hash:")} ${deployedType.codeHash}`);
          this.log(`${chalk.cyan("  Type ID Hash Type:")} ${deployedType.hashType}`);
          this.log(`${chalk.cyan("  Type ID Args:")} ${deployedType.args}`);
          this.log(`${chalk.cyan("  Type ID Script Hash:")} ${deployedType.hash()}`);
          this.log(chalk.gray("\n  When using this contract in other cells:"));
          this.log(chalk.gray(`    Use the Type ID Script Hash as the code hash with hash type "type"`));
        } else {
          this.log(chalk.yellow("\nDeployed with custom type script:"));
          this.log(`${chalk.cyan("  Code Hash:")} ${deployedType.codeHash}`);
          this.log(`${chalk.cyan("  Hash Type:")} ${deployedType.hashType}`);
          this.log(`${chalk.cyan("  Args:")} ${deployedType.args}`);
          this.log(chalk.gray(`  Script Hash: ${deployedType.hash()}`));
        }
      }


      // Update centralized deployments.json
      await this.updateDeploymentsJson(deploymentInfo, network);

    } catch (error) {
      this.error(`Deployment failed: ${error}`);
    }
  }

  private generateDeploymentTag(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `v${year}${month}${day}-${hours}${minutes}`;
  }

  private async findExistingDeployment(
    contractName: string,
    network: string,
    tag: string
  ): Promise<any | null> {
    try {
      // Check deployments.json
      if (fs.existsSync('deployments.json')) {
        try {
          const deploymentsJson = JSON.parse(fs.readFileSync('deployments.json', 'utf8'));
          if (deploymentsJson.history && deploymentsJson.history[network]) {
            const historyDeployments = deploymentsJson.history[network].filter(
              (d: any) => d.contractName === contractName && d.tag === tag && d.typeScript
            );
            
            if (historyDeployments.length > 0) {
              const deployment = historyDeployments[0];
              this.log(chalk.yellow(`Found existing deployment with tag '${tag}' in deployments.json`));
              return deployment;
            }
          }
        } catch (e) {
          // Skip if invalid
        }
      }
    } catch (error) {
      // No existing deployments found
    }
    return null;
  }

  private async updateDeploymentsJson(
    deploymentInfo: any,
    network: string
  ): Promise<void> {
    const deploymentsPath = 'deployments.json';
    let deployments: any = {
      current: {
        testnet: {},
        mainnet: {}
      },
      history: {
        testnet: [],
        mainnet: []
      }
    };

    // Load existing deployments.json if it exists
    if (fs.existsSync(deploymentsPath)) {
      try {
        const content = fs.readFileSync(deploymentsPath, 'utf8');
        deployments = JSON.parse(content);
        
        // Ensure all required structures exist
        if (!deployments.current) deployments.current = {};
        if (!deployments.current.testnet) deployments.current.testnet = {};
        if (!deployments.current.mainnet) deployments.current.mainnet = {};
        if (!deployments.history) deployments.history = {};
        if (!deployments.history.testnet) deployments.history.testnet = [];
        if (!deployments.history.mainnet) deployments.history.mainnet = [];
      } catch (error) {
        this.log(chalk.yellow('Warning: Could not parse existing deployments.json, creating new one'));
      }
    }

    // Determine contract type from name (e.g., "protocol-type" -> "protocolType")
    const contractType = this.getContractType(deploymentInfo.contractName);
    
    // Prepare deployment record with proper nested structure
    const deploymentRecord = {
      contractName: deploymentInfo.contractName,
      transactionHash: deploymentInfo.transactionHash,
      index: 0, // Assuming first output contains the contract
      deployedAt: deploymentInfo.deployedAt,
      deployerAddress: deploymentInfo.deployerAddress,
      dataHash: deploymentInfo.dataHash,
      contractSize: deploymentInfo.contractSize,
      tag: deploymentInfo.tag,
      isUpgrade: deploymentInfo.isUpgrade || false,
      ...(deploymentInfo.previousDeployment && {
        previousDeployment: deploymentInfo.previousDeployment
      }),
      ...(deploymentInfo.typeScript && {
        typeScript: deploymentInfo.typeScript,
        isTypeId: deploymentInfo.isTypeId
      }),
      typeHash: deploymentInfo.typeHash
    };

    // Update current deployment with same nested structure
    if (deploymentInfo.typeScript) {
      deployments.current[network][contractType] = {
        transactionHash: deploymentInfo.transactionHash,
        index: 0,
        deployedAt: deploymentInfo.deployedAt,
        contractName: deploymentInfo.contractName,
        tag: deploymentInfo.tag,
        dataHash: deploymentInfo.dataHash,
        typeScript: deploymentInfo.typeScript,
        isTypeId: deploymentInfo.isTypeId,
        typeHash: deploymentInfo.typeHash
      };
    } else {
      // For deployments without type script, set to null to maintain structure
      deployments.current[network][contractType] = null;
    }

    // Add to history
    if (!deployments.history[network]) {
      deployments.history[network] = [];
    }
    deployments.history[network].push(deploymentRecord);

    // Save updated deployments.json
    fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
    this.log(chalk.green(`\n📋 Updated deployments.json`));
  }

  private getContractType(contractName: string): string {
    // Convert contract names to camelCase type
    // Examples: "protocol-type" -> "protocolType", "my-awesome-contract" -> "myAwesomeContract"
    const parts = contractName.toLowerCase().split(/[-_]/);
    
    if (parts.length === 0) return contractName;
    
    // Convert to camelCase
    return parts[0] + parts.slice(1)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  private async interactiveUpgradeMode(
    contractName: string,
    network: string
  ): Promise<{ fromTag: string; toTag: string } | null> {
    this.log(chalk.blue("\n🚀 Interactive Upgrade Mode"));
    this.log(chalk.gray("═".repeat(50)));
    
    // Find all existing deployments for this contract
    const allDeployments = await this.findAllDeployments(contractName, network);
    
    if (allDeployments.length === 0) {
      this.log(chalk.yellow("No existing deployments found for this contract."));
      this.log(chalk.yellow("Please deploy the contract first before attempting an upgrade."));
      return null;
    }
    
    // Filter to only show deployments that haven't been upgraded yet
    // Create a set of all tags that have been upgraded
    const upgradedTags = new Set<string>();
    allDeployments.forEach(dep => {
      if (dep.isUpgrade && dep.previousDeployment?.tag) {
        upgradedTags.add(dep.previousDeployment.tag);
      }
    });
    
    // Filter out deployments that have been upgraded
    const upgradeableDeployments = allDeployments.filter(dep => {
      // Must have Type ID to be upgradeable
      if (!dep.isTypeId) return false;
      // Must have a tag
      if (!dep.tag) return false;
      // Must not have been upgraded already
      return !upgradedTags.has(dep.tag);
    });
    
    if (upgradeableDeployments.length === 0) {
      this.log(chalk.yellow("No upgradeable deployments found."));
      return null;
    }
    
    // Sort deployments by date (newest first)
    upgradeableDeployments.sort((a, b) => {
      const dateA = new Date(a.deployedAt || '').getTime();
      const dateB = new Date(b.deployedAt || '').getTime();
      return dateB - dateA;
    });
    
    // Select deployment to upgrade from
    const fromDeployment = await select({
      message: 'Select the deployment to upgrade from:',
      choices: upgradeableDeployments.map(dep => ({
        name: `${dep.tag || 'unknown'} - ${dep.deployedAt ? new Date(dep.deployedAt).toLocaleString() : 'unknown date'} (${dep.transactionHash?.substring(0, 10)}...)`,
        value: dep,
        description: dep.isUpgrade ? `Upgradeable deployment` : 'Initial deployment'
      }))
    });
    
    if (!fromDeployment.tag) {
      this.log(chalk.red("Selected deployment doesn't have a tag. Cannot proceed with upgrade."));
      return null;
    }
    
    // Show current deployment info
    this.log(chalk.cyan("\nCurrent deployment details:"));
    this.log(`  Tag: ${fromDeployment.tag}`);
    this.log(`  Transaction: ${fromDeployment.transactionHash}`);
    this.log(`  Index: ${fromDeployment.index}`);
    this.log(`  Deployed at: ${fromDeployment.deployedAt}`);
    if (fromDeployment.typeScript) {
      if (fromDeployment.isTypeId) {
        this.log(`  Type: Type ID (upgradeable)`);
        this.log(`  Type ID Args: ${fromDeployment.typeScript.args}`);
      } else {
        this.log(`  Type Script Code Hash: ${fromDeployment.typeScript.codeHash}`);
        this.log(`  Type Script Hash Type: ${fromDeployment.typeScript.hashType}`);
        this.log(`  Type Script Args: ${fromDeployment.typeScript.args}`);
      }
      this.log(`  Type Script Hash: ${fromDeployment.typeHash || 'N/A'}`);
    }
    
    // Ask for new tag
    let newTag: string;
    
    // Check if current tag uses semantic versioning
    // Supports various prefixes like v1.0.0, release-1.0.0, version-1.0.0, app-v1.0.0, etc.
    const versionMatch = fromDeployment.tag.match(/^(.*?)(\d+)\.(\d+)\.(\d+)(.*)$/);
    if (versionMatch && versionMatch[2]) {  // Ensure we have version numbers
      // Offer version increment options
      const versionType = await select({
        message: 'Select version increment type:',
        choices: [
          {
            name: `Patch (${this.suggestNextTag(fromDeployment.tag, 'patch')})`,
            value: 'patch',
            description: 'Bug fixes and minor changes'
          },
          {
            name: `Minor (${this.suggestNextTag(fromDeployment.tag, 'minor')})`,
            value: 'minor',
            description: 'New features, backward compatible'
          },
          {
            name: `Major (${this.suggestNextTag(fromDeployment.tag, 'major')})`,
            value: 'major',
            description: 'Breaking changes'
          },
          {
            name: 'Custom',
            value: 'custom',
            description: 'Enter a custom version tag'
          }
        ]
      });
      
      if (versionType === 'custom') {
        newTag = await input({
          message: 'Enter custom tag:',
          default: this.suggestNextTag(fromDeployment.tag, 'patch'),
          validate: (value) => {
            if (!value.trim()) {
              return 'Tag cannot be empty';
            }
            if (value === fromDeployment.tag) {
              return 'New tag must be different from the current tag';
            }
            return true;
          }
        });
      } else {
        const suggestedTag = this.suggestNextTag(fromDeployment.tag, versionType as 'major' | 'minor' | 'patch');
        // Allow user to confirm or modify the suggested tag
        newTag = await input({
          message: 'Confirm or modify the version tag:',
          default: suggestedTag,
          validate: (value) => {
            if (!value.trim()) {
              return 'Tag cannot be empty';
            }
            if (value === fromDeployment.tag) {
              return 'New tag must be different from the current tag';
            }
            return true;
          }
        });
      }
    } else {
      // Non-semantic versioning, check if it's a timestamp-based tag
      let defaultNewTag: string;
      
      // Check if current tag is timestamp-based (vYYYYMMDD-HHMM format)
      const timestampMatch = fromDeployment.tag.match(/^v(\d{8})-(\d{4})$/);
      if (timestampMatch) {
        // Generate a new timestamp-based tag
        defaultNewTag = this.generateDeploymentTag();
      } else {
        // For other formats, just append -new
        defaultNewTag = `${fromDeployment.tag}-new`;
      }
      
      newTag = await input({
        message: 'Enter tag for the new version:',
        default: defaultNewTag,
        validate: (value) => {
          if (!value.trim()) {
            return 'Tag cannot be empty';
          }
          if (value === fromDeployment.tag) {
            return 'New tag must be different from the current tag';
          }
          return true;
        }
      });
    }
    
    // Confirm upgrade
    const confirmUpgrade = await confirm({
      message: `Upgrade from ${fromDeployment.tag} to ${newTag}?`,
      default: true
    });
    
    if (!confirmUpgrade) {
      return null;
    }
    
    return {
      fromTag: fromDeployment.tag,
      toTag: newTag
    };
  }
  
  private async findAllDeployments(
    contractName: string,
    network: string
  ): Promise<any[]> {
    const deployments: any[] = [];
    
    try {
      // Check deployments.json
      if (fs.existsSync('deployments.json')) {
        try {
          const deploymentsJson = JSON.parse(fs.readFileSync('deployments.json', 'utf8'));
          if (deploymentsJson.history && deploymentsJson.history[network]) {
            const historyDeployments = deploymentsJson.history[network].filter(
              (d: any) => d.contractName === contractName && d.tag
            );
            
            deployments.push(...historyDeployments);
          }
        } catch (e) {
          // Skip if invalid
        }
      }
      
      // Remove duplicates based on transaction hash
      const seen = new Set();
      return deployments.filter(dep => {
        if (seen.has(dep.transactionHash)) {
          return false;
        }
        seen.add(dep.transactionHash);
        return true;
      });
    } catch (error) {
      return [];
    }
  }
  
  private suggestNextTag(currentTag: string, incrementType: 'major' | 'minor' | 'patch' = 'patch'): string {
    // Try to parse semantic version and increment
    // Captures: prefix (optional), major, minor, patch, suffix (optional)
    // Uses non-greedy match for prefix to properly capture version numbers
    const versionMatch = currentTag.match(/^(.*?)(\d+)\.(\d+)\.(\d+)(.*)$/);
    if (versionMatch) {
      const prefix = versionMatch[1] || '';
      let major = parseInt(versionMatch[2]);
      let minor = parseInt(versionMatch[3]);
      let patch = parseInt(versionMatch[4]);
      const suffix = versionMatch[5] || '';
      
      switch (incrementType) {
        case 'major':
          major++;
          minor = 0;
          patch = 0;
          break;
        case 'minor':
          minor++;
          patch = 0;
          break;
        case 'patch':
        default:
          patch++;
          break;
      }
      
      // Preserve the original prefix (if any)
      return `${prefix}${major}.${minor}.${patch}${suffix}`;
    }
    
    // If not semantic versioning, just append -new
    return `${currentTag}-new`;
  }

  private async interactiveDeploymentMode(
    contractName: string,
    defaultTypeId: boolean,
    providedTag?: string
  ): Promise<{ useTypeId: boolean; tag: string } | null> {
    this.log(chalk.blue("\n🚀 Interactive Deployment Mode"));
    this.log(chalk.gray("═".repeat(50)));
    
    // Ask about Type ID support
    const useTypeId = await confirm({
      message: 'Deploy with Type ID support? (allows future contract upgrades)',
      default: defaultTypeId
    });
    
    // Show implications
    if (useTypeId) {
      this.log(chalk.green("\n✓ Type ID deployment selected"));
      this.log(chalk.gray("  • Contract can be upgraded in the future"));
      this.log(chalk.gray("  • Maintains same script hash across upgrades"));
      this.log(chalk.gray("  • Requires tracking Type ID args for upgrades"));
    } else {
      this.log(chalk.yellow("\n⚠️  Non-Type ID deployment selected"));
      this.log(chalk.gray("  • Contract cannot be upgraded"));
      this.log(chalk.gray("  • Lower deployment cost"));
      this.log(chalk.gray("  • Simpler deployment process"));
    }
    
    // Ask about deployment tag
    let tag = providedTag;
    if (!tag) {
      const autoTag = this.generateDeploymentTag();
      
      const tagChoice = await select({
        message: '\nHow would you like to tag this deployment?',
        choices: [
          {
            name: `Use auto-generated tag (${autoTag})`,
            value: 'auto',
            description: 'Timestamp-based tag for tracking'
          },
          {
            name: 'Use semantic version (v1.0.0)',
            value: 'semantic',
            description: 'Standard version numbering'
          },
          {
            name: 'Enter custom tag',
            value: 'custom',
            description: 'Your own tag format'
          }
        ]
      });
      
      switch (tagChoice) {
        case 'auto':
          tag = autoTag;
          break;
        case 'semantic':
          tag = await input({
            message: 'Enter semantic version:',
            default: 'v1.0.0',
            validate: (value) => {
              if (!value.trim()) {
                return 'Tag cannot be empty';
              }
              // Basic semantic version validation
              if (!/^v?\d+\.\d+\.\d+/.test(value)) {
                return 'Please use semantic version format (e.g., v1.0.0, 1.0.0)';
              }
              return true;
            }
          });
          break;
        case 'custom':
          tag = await input({
            message: 'Enter custom tag:',
            default: contractName + '-v1',
            validate: (value) => {
              if (!value.trim()) {
                return 'Tag cannot be empty';
              }
              return true;
            }
          });
          break;
      }
    }
    
    // Show deployment preview
    this.log(chalk.cyan("\n📋 Deployment Preview:"));
    this.log(`  Contract: ${contractName}`);
    this.log(`  Type ID: ${useTypeId ? 'Yes (upgradeable)' : 'No (permanent)'}`);
    this.log(`  Tag: ${tag}`);
    
    // Confirm deployment
    const confirmDeploy = await confirm({
      message: '\nProceed with this configuration?',
      default: true
    });
    
    if (!confirmDeploy) {
      return null;
    }
    
    return {
      useTypeId,
      tag: tag!  // We know tag is defined at this point
    };
  }
}