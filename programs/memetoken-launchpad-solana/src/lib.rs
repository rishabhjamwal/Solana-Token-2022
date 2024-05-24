use anchor_lang::prelude::*;
// use anchor_lang::solana_program::system_instruction;
// use anchor_lang::solana_program::native_token::LAMPORTS_PER_SOL;
use anchor_lang::system_program::{transfer, Transfer};
// use anchor_spl::token_interface::Token2022;

use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{self, burn, Burn, Mint, MintTo, TokenInterface, TokenAccount};
// use solana_program::pubkey::Pubkey;


// This is your program's public key and it will update
// automatically when you build the project.
declare_id!("EjsTq7pz5Q7xfpZyyBVYvH6zUkC1cRtKVbYtrjyj4QJ4");

#[program]
mod memetoken_launchpad_solana {
    // use anchor_lang::solana_program::native_token::LAMPORTS_PER_SOL;

    // use anchor_lang::solana_program::native_token::LAMPORTS_PER_SOL;

    use super::*;
    // use anchor_lang::system_program;
    // const AMOUNT: u64 = LAMPORTS_PER_SOL;

    pub fn create_vault_account(ctx: Context<VaultAccount>) -> Result<()> {
        let vault_account = &ctx.accounts.vault_account;
        msg!("This is my vault account PDA: {:?}", vault_account);
        Ok(())
    }
    

    pub fn mint_token(ctx: Context<MintToken>, sol_amount: u64) -> Result<()> {
        let additional_sol = 20.5;
        let additional_lamports = (additional_sol * 1_000_000_000.0) as u64;
        let reserve_balance = ctx.accounts.vault_account.get_lamports() +additional_lamports;
        
        let current_supply = ctx.accounts.mint.supply;
        
        let connector_weight = 0.5;

         // Calculate new token supply using the Bancor formula
         let sol_amount_decimal = sol_amount as f64;
         let reserve_balance_decimal = reserve_balance as f64;
         let current_supply_decimal = current_supply as f64;
         let cw_decimal = connector_weight as f64;
         msg!("Deposited SOL amount \n {:?}", (sol_amount_decimal/1000000000.0));
         msg!("Reserve Balance at the strat of the function \n {:?}", (reserve_balance_decimal/1000000000.0));
         msg!("Current supply at the start of the function \n {:?}", (current_supply_decimal/100.0));
         msg!("The Connector Weight: \n {:?}", cw_decimal);
         let price = (reserve_balance_decimal/1000000000.0)/((current_supply_decimal/100.0)*cw_decimal);
         msg!("Price at the start of the function  \n {:?}", price);
         let market_cap = price * current_supply_decimal/100.0;
         msg!("market cap at the start of the function  \n {:?}", market_cap);





        // Calculating the new supply after purchase
        // new_supply = current_supply * ((1 + sol_paid / reserve_balance) ^ (1 / cw))
        let new_supply = (current_supply_decimal/100.0) * ((1.0 + (sol_amount_decimal/1000000000.0) / (reserve_balance_decimal/1000000000.0)).powf(1.0 / cw_decimal));

        msg!("This will be the new supply after purchase \n {:?}", new_supply);


        // Calculate the exact number of tokens to mint
        let tokens_to_mint = (new_supply - (current_supply_decimal/100.0)) as u64;
        msg!("Current Supply - New Supply = TokensToMint \n {:?}", tokens_to_mint);

        // Create the MintTo struct for our context
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.vault_account.to_account_info(),
            },
        );
        transfer(cpi_context, sol_amount)?;
        // // let amount = calculate_purchse_return();x
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.user_account.to_account_info(),
            authority: ctx.accounts.mint_authority.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        // // Create the CpiContext we need for the request
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        // // Execute anchor's helper function to mint tokens
        token_interface::mint_to(cpi_ctx, tokens_to_mint*100)?;

        let reserve_balance_after_minting = ctx.accounts.vault_account.get_lamports() +additional_lamports;
        let reserve_balance_after_minting_as_f64 = (reserve_balance_after_minting/1000000000) as f64;
        let current_supply_after_minting = ctx.accounts.mint.supply;

        let current_supply_decimal_after_minting = (current_supply_after_minting/100) as f64;
        msg!("Reserve Balance at the end of the function \n {:?}", reserve_balance_after_minting);
        msg!("Current supply at the end of the function \n {:?}", current_supply_decimal_after_minting);

        let new_price = reserve_balance_after_minting_as_f64/(current_supply_decimal_after_minting * cw_decimal);
        msg!("New price: \n {:?}", new_price);
        let new_market_cap = price * current_supply_decimal_after_minting;
        msg!("New market-cap :  \n {:?}", new_market_cap);




        Ok(())
    }

    pub fn burn_token(ctx: Context<BurnToken>, tokens_to_burn: u64) -> Result<()> {
        let additional_sol = 20.5;
        let additional_lamports = (additional_sol * 1_000_000_000.0) as f64;
        //Current supply before burning
        let current_balance_of_user = ctx.accounts.user.to_account_info().lamports();
        msg!("Current balance of the user: {:?}", current_balance_of_user);
        let current_supply = ctx.accounts.mint.supply as f64;
        msg!("Current Supply: {:?}", current_supply);
        let current_supply_decimal = current_supply as f64;
        msg!("Current Supply with decimal : {:?}", current_supply_decimal);
        msg!("Tokens to burn : {:?}", tokens_to_burn);
        let tokens_to_burn_decimal = tokens_to_burn*100;

        burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    authority: ctx.accounts.user.to_account_info(),
                    from: ctx.accounts.token_account.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                },
            ),
            tokens_to_burn_decimal,
        )?;
        // Retrieve the current reserve balance and current supply
        let reserve_balance = (ctx.accounts.vault_account.to_account_info().lamports() as f64) + additional_lamports;

        msg!("Reserve Balance: {:?}", reserve_balance);
        let connector_weight = 0.5; // This should be consistent with what was used in minting

        // Calculate the SOL to return using the Bancor formula
        // new_supply = current_supply - tokens_to_burn
        let new_supply = (current_supply/100.0) - (tokens_to_burn as f64);
        msg!("New supply after burning {:?}", new_supply);



        // Calculate SOL return using the inverse Bancor formula:
        // sol_return = reserve_balance * (1 - (new_supply / current_supply)^connector_weight)

        msg!("({:?}/1000000000.0)*(1.0 -({:?}/({:?}/100.0)).powf({:?}))", reserve_balance, new_supply,current_supply_decimal,connector_weight);
        let sol_return = reserve_balance/1000000000.0 * (1.0 - (new_supply /( current_supply_decimal/100.0) ).powf(connector_weight));
        msg!("Returned SOL: {:?}",sol_return);
        let sol_return_in_lamports = (sol_return * 1000000000.0) as u64;

        // Safely cast to u64
        // let sol_return = (sol_return as u64) * LAMPORTS_PER_SOL;
        **ctx
            .accounts
            .vault_account
            .to_account_info()
            .try_borrow_mut_lamports()? -= sol_return_in_lamports;
        **ctx
            .accounts
            .user
            .to_account_info()
            .try_borrow_mut_lamports()? += sol_return_in_lamports;
        let reserve_balance_after_burning =ctx.accounts.vault_account.to_account_info().lamports() as f64 + additional_lamports;
        let current_balance_of_user_after_burning = ctx.accounts.user.to_account_info().lamports();


        msg!("Reserve balance after burning: {:?}", reserve_balance_after_burning);
        msg!("Current balance of user after burning and recieving SOL: {:?}", current_balance_of_user_after_burning);

        Ok(())
    }



    pub fn create_associated_token_account(_ctx: Context<ATA>) -> Result<()> {
        Ok(())
    }
    
    
 
}

#[derive(Accounts)]
pub struct VaultAccount<'info> {
    #[account(init, payer=signer, seeds = ["vault_account".as_bytes(), mint.key().as_ref()],bump, space=8+8)]
    pub vault_account: Account<'info, Vault>,
    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct MintToken<'info> {
    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub user_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK: This is not dangerous because we are only using it to sign CPI calls.
    pub mint_authority: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,

    #[account(mut, seeds= [b"vault_account", mint.key().as_ref()], bump)]
    /// CHECK: This account is assumed to be a PDA managed by the contract.
    pub vault_account: Account<'info, Vault>,
}
#[derive(Accounts)]
pub struct BurnToken<'info> {
    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    #[account(mut, seeds= [b"vault_account", mint.key().as_ref()], bump)]
    /// CHECK: This account is assumed to be a PDA managed by the contract.

    pub vault_account: AccountInfo<'info>,
}



#[derive(Accounts)]
pub struct Test<'info> {
    pub system_program: Program<'info, System>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, seeds= [b"vault_account"], bump)]
    pub vault_account: Account<'info, Vault>,
}
#[account]
#[derive(Debug)]
pub struct Vault {}

#[derive(Accounts)]
pub struct ATA<'info> {
    #[account(
        init_if_needed,
        payer = payer, 
        associated_token::mint = mint, 
        associated_token::authority = payer
    )]
    pub token_account: InterfaceAccount<'info, TokenAccount>,

    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

