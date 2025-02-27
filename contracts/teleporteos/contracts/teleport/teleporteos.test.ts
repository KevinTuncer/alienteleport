import {
  ContractDeployer,
  assertRowsEqual,
  AccountManager,
  Account,
  assertEOSErrorIncludesMessage,
  assertMissingAuthority,
  EOSManager,
  debugPromise,
  assertRowsEqualStrict,
  assertRowCount,
  assertEOSException,
  assertEOSError,
  UpdateAuth,
  assertRowsContain,
} from 'lamington'
import * as chai from 'chai'

import { Teleporteos, TeleporteosStatsItem } from './teleporteos'
import { EosioToken } from '../eosio.token/eosio.token'

const ethToken = '2222222222222222222222222222222222222222222222222222222222222222'

const token_contract = 'alien.worlds'
const token_symbol = 'TLM'

let teleporteos: Teleporteos
let alienworldsToken: EosioToken

let sender1: Account
let sender2: Account
let oracle1: Account
let oracle2: Account
let oracle3: Account
let oracle4: Account

describe('teleporteos', async () => {
  before(async () => {
    await seedAccounts()
  })
  // Initialize contract
  context('initialize contract', async () => {
    context('without correct auth', async () => {
      it('should fail with auth error', async () => {
        await assertMissingAuthority(
          teleporteos.ini(`100.0000 ${token_symbol}`, `0.0000 ${token_symbol}`, '0', false, 3, 0, { from: sender1 })
        )
      })
    })
    context('with correct auth', async () => {
      it('should succeed', async () => {
        await teleporteos.ini(`100.0000 ${token_symbol}`, `0.0000 ${token_symbol}`, '0', false, 3, 0, { from: teleporteos.account })
      })

      it('execute again should fail', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.ini(`50.0000 ${token_symbol}`, `0.0000 ${token_symbol}`, '0', false, 3, 0, { from: teleporteos.account }),
          'Already initialized'
        )
      })
      it('should update stats table', async () => {
        let { rows: [item] } = await teleporteos.statsTable()
        chai.expect(item.tokencontr).equal(token_contract, 'Wrong token contract')
        chai.expect(item.collected).equal(0, 'Wrong collected')
        chai.expect(item.fin).equal(false, 'Wrong freeze in')
        chai.expect(item.fout).equal(false, 'Wrong freeze out')
        chai.expect(item.fcancel).equal(false, 'Wrong freeze cancel')
        chai.expect(item.foracles).equal(false, 'Wrong freeze oracles')
        chai.expect(item.oracles).equal(0, 'Wrong oracle amount')
        chai.expect(item.min).equal(1000000, 'Wrong minimum transfer amount')
        chai.expect(item.fixfee).equal(0, 'Wrong fix fee')
        chai.expect(item.varfee).equal('0.00000000000000000', 'Wrong variable fee')
        chai.expect(item.version).above(0, 'Wrong version')
        chai.expect(item.chains.length).equal(0, 'Wrong amount of added chains')
      })
    })
  })
  // Add chains
  context('add chain', async () => {
    context('without correct auth', async () => {
      it('should fail with auth error', async () => {
        await assertMissingAuthority(
          teleporteos.addchain('Ethereum', 'ETH', 1, '1', '0x497329439abdc323u497329439abdc323u', '0x497329439abdc323u497329439abdc323u', { from: sender1 })
        )
      })
    })
    context('with correct auth', async () => {
      const ethName = 'Ethereum'
      const ethShortName = 'ETH'
      const ethId = 1
      const ethNetId = '1'
      const ethContract = '0x497329439abdc323u497329439abdc323u'
      const ethTokenContract = '0x557329439abdc323u497329439abdc3266'

      it('should succeed', async () => {
        await teleporteos.addchain(ethName, ethShortName, ethId, ethNetId, ethContract, ethTokenContract, { from: teleporteos.account })
      })
      it('should update stats table', async () => {
        const { rows: [item] } = await teleporteos.statsTable()        
        chai.expect(item.chains.length).equal(1, 'Wrong amount of added chains')
        const chain = item.chains[0] as unknown as {key: number, value: {name: string, net_id: string, teleaddr: string, tokenaddr: string}}
        chai.expect(chain.key).equal(ethId, 'Wrong chain id' + ' got: ' + String(item.chains[0]))
        chai.expect(chain.value.name).equal(ethName, 'Wrong chain name')
        chai.expect(chain.value.net_id).equal(ethNetId, 'Wrong chain name')
        chai.expect(chain.value.teleaddr).equal(ethContract, 'Wrong chain id')
        chai.expect(chain.value.tokenaddr).equal(ethTokenContract, 'Wrong chain id')
      })
      it('should fail with already existing id', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.addchain(ethName, ethShortName, ethId, ethNetId, ethContract, ethTokenContract, { from: teleporteos.account }), 
          'This chain is already listed'
        )
      })
      it('should succeed to add another three chains', async () => {
        await teleporteos.addchain('Binance Smart Chain', 'BSC', 2, '2', ethContract, ethTokenContract, { from: teleporteos.account })
        await teleporteos.addchain('WAX', 'WAX', 6, '6', 'bridge.chain', 'my.token', { from: teleporteos.account })
        await teleporteos.addchain('Bitcoin', 'BTC', 3, '3', ethContract, ethTokenContract, { from: teleporteos.account })
        await teleporteos.addchain('TRON', 'TRON', 4, '4', ethContract, ethTokenContract, { from: teleporteos.account })
        await teleporteos.addchain('XMR', 'XMR', 5, '5', ethContract, ethTokenContract, { from: teleporteos.account })
      })
      it('should update stats table', async () => {
        const { rows: [item] } = await teleporteos.statsTable()
        chai.expect(item.chains.length).equal(6, 'Wrong amount of added chains')
      })
    })
  })
  // Remove chain
  context('remove chain', async () => {
    context('without correct auth', async () => {
      it('should fail with auth error', async () => {
        await assertMissingAuthority(
          teleporteos.rmchain(6, { from: sender1 })
        )
      })
    })
    context('with correct auth', async () => {
      it('should succeed', async () => {
        await teleporteos.rmchain(6, { from: teleporteos.account })
      })
      it('should update stats table', async () => {
        const { rows: [item] } = await teleporteos.statsTable()
        chai.expect(item.chains.length).equal(5, 'Wrong amount of remaining chains')
      })
    })
  })
  // Recoracle
  context('regoracle', async () => {
    context('without correct auth', async () => {
      it('should fail with auth error', async () => {
        await assertMissingAuthority(
          teleporteos.regoracle(oracle1.name, { from: sender1 })
        )
      })
    })
    context('with correct auth', async () => {
      it('should succeed for oracle1', async () => {
        await teleporteos.regoracle(oracle1.name, {
          from: teleporteos.account,
        })
      })
      it('should succeed to add another oracle', async () => {
        await teleporteos.regoracle(oracle2.name, {
          from: teleporteos.account,
        })
      })
      it('should succeed to add another oracle', async () => {
        await teleporteos.regoracle(oracle3.name, {
          from: teleporteos.account,
        })
      })
      it('should succeed to add another oracle', async () => {
        await teleporteos.regoracle(oracle4.name, {
          from: teleporteos.account,
        })
      })
      it('should update oracles table', async () => {
        await assertRowsEqual(teleporteos.oraclesTable(), [
          { account: oracle1.name },
          { account: oracle2.name },
          { account: oracle3.name },
          { account: oracle4.name },
        ])
      })
    })
  })

  // Unrecoracle
  context('unregoracle', async () => {
    context('with incorrect auth', async () => {
      it('should fail with auth error', async () => {
        await assertMissingAuthority(
          teleporteos.unregoracle(oracle4.name, { from: sender1 })
        )
      })
    })
    context('with correct auth', async () => {
      it('should succeed', async () => {
        await teleporteos.unregoracle(oracle4.name, {
          from: teleporteos.account,
        })
      })
      it('should update oracles table', async () => {
        await assertRowsEqual(teleporteos.oraclesTable(), [
          { account: oracle1.name },
          { account: oracle2.name },
          { account: oracle3.name },
        ])
      })
    })
  })
  context('received from BSC/ETH', async () => {
    context('with unregistered oracle', async () => {
      it('should fail', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.received(
            sender1.name,
            sender1.name,
            '1111111111111111111111111111111111111111111111111111111111111111',
            `123.0000 ${token_symbol}`,
            2,
            true,
            {
              from: sender1,
            }
          ),
          'Account is not an oracle'
        )
      })
    })
    context('with registered oracle', async () => {
      context('with wrong auth', async () => {
        it('should fail with auth error', async () => {
          await assertMissingAuthority(
            teleporteos.received(
              oracle3.name,
              sender1.name,
              '1111111111111111111111111111111111111111111111111111111111111111',
              `123.0000 ${token_symbol}`,
              2,
              true,
              { from: sender1 }
            )
          )
        })
      })
      context('with correct auth', async () => {
        it('should succeed', async () => {
          await teleporteos.received(
            oracle3.name,
            sender1.name,
            '1111111111111111111111111111111111111111111111111111111111111111',
            `123.0000 ${token_symbol}`,
            2,
            true,
            { from: oracle3 }
          )
        })
        it('should insert into receipt table', async () => {
          await assertRowsEqual(teleporteos.receiptsTable(), [
            {
              approvers: [oracle3.name],
              chain_id: 2,
              completed: false,
              confirmations: 1,
              date: new Date(),
              id: 0,
              quantity: `123.0000 ${token_symbol}`,
              ref: '1111111111111111111111111111111111111111111111111111111111111111',
              to: sender1.name,
            },
          ])
        })
      })
    })
    context('with another registered oracle', async () => {
      it('should add another receipt to existing', async () => {
        await teleporteos.received(
          oracle1.name,
          sender1.name,
          '1111111111111111111111111111111111111111111111111111111111111111',
          `123.0000 ${token_symbol}`,
          2,
          true,
          { from: oracle1 }
        )
      })
    })
    context('with mismatch quantity', async () => {
      it('should fail with Quantity mismatch error', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.received(
            oracle3.name,
            sender1.name,
            '1111111111111111111111111111111111111111111111111111111111111111',
            `0.1230 ${token_symbol}`,
            2,
            true,
            { from: oracle3 }
          ),
          'Quantity mismatch'
        )
      })
    })
    context('with account mismatch', async () => {
      it('should fail with account mismatch error', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.received(
            oracle3.name,
            sender2.name,
            '1111111111111111111111111111111111111111111111111111111111111111',
            `123.0000 ${token_symbol}`,
            2,
            true,
            { from: oracle3 }
          ),
          'Account mismatch'
        )
      })
    })
    context('with already signed oracle', async () => {
      it('should fail with already approved error', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.received(
            oracle3.name,
            sender1.name,
            '1111111111111111111111111111111111111111111111111111111111111111',
            `123.0000 ${token_symbol}`,
            2,
            true,
            { from: oracle3 }
          ),
          'Oracle has already approved'
        )
      })
    })
    context('with 3 full approvals', async () => {
      it('should succeed', async () => {
        await teleporteos.received(
          oracle2.name,
          sender1.name,
          '1111111111111111111111111111111111111111111111111111111111111111',
          `123.0000 ${token_symbol}`,
          2,
          true,
          {
            from: oracle2,
          }
        )
      })
      it('should transfer tokens', async () => {
        await assertRowsEqual(
          alienworldsToken.accountsTable({ scope: sender1.name }),
          [
            {
              balance: `1000123.0000 ${token_symbol}`,
            },
          ]
        )
      })
      it('should update receipt table', async () => {
        await assertRowsEqual(teleporteos.receiptsTable(), [
          {
            approvers: [oracle1.name, oracle2.name, oracle3.name],
            chain_id: 2,
            completed: true,
            confirmations: 3,
            date: new Date(),
            id: 0,
            quantity: `123.0000 ${token_symbol}`,
            ref: '1111111111111111111111111111111111111111111111111111111111111111',
            to: sender1.name,
          },
        ])
      })
    })
  })

  // Recrepair
  context('recrepair', async () => {
    before(async () => {
      await teleporteos.received(
        oracle1.name,
        sender1.name,
        '1111111111111111111111111111111111111111111111111111111111111112',
        `0.1230 ${token_symbol}`,
        2,
        true,
        { from: oracle1 }
      )
    })
    context('with wrong auth', async () => {
      it('should fail', async () => {
        await assertMissingAuthority(
          teleporteos.repairrec(1, `123.0000 ${token_symbol}`, [oracle1.name], true, {
            from: sender1,
          })
        )
      })
    })
    context('with correct auth', async () => {
      context('with non-existing receipt', async () => {
        it('should fail', async () => {
          await assertEOSErrorIncludesMessage(
            teleporteos.repairrec(4, `123.0000 ${token_symbol}`, [oracle1.name], true, {
              from: teleporteos.account,
            }),
            'Receipt does not exist.'
          )
        })
      })
    })
    context('with existing receipt', async () => {
      context('with invalid quantity', async () => {
        it('should fail', async () => {
          await assertEOSErrorIncludesMessage(
            teleporteos.repairrec(1, '123.0000', [oracle1.name], true, {
              from: teleporteos.account,
            }),
            'Asset not valid'
          )
        })
      })
      context('with negative quantity', async () => {
        it('should fail', async () => {
          await assertEOSErrorIncludesMessage(
            teleporteos.repairrec(1, `-123.0000 ${token_symbol}`, [oracle1.name], true, {
              from: teleporteos.account,
            }),
            'Quantity cannot be negative'
          )
        })
      })
      context('with valid params', async () => {
        it('should succeed', async () => {
          await teleporteos.repairrec(
            1,
            `124.0000 ${token_symbol}`,
            [oracle1.name],
            false,
            { from: teleporteos.account }
          )
        })
        it('should update the receipts table', async () => {
          await assertRowsEqual(teleporteos.receiptsTable(), [
            {
              approvers: [oracle1.name, oracle2.name, oracle3.name],
              chain_id: 2,
              completed: true,
              confirmations: 3,
              date: new Date(),
              id: 0,
              quantity: `123.0000 ${token_symbol}`,
              ref: '1111111111111111111111111111111111111111111111111111111111111111',
              to: sender1.name,
            },
            {
              approvers: [oracle1.name],
              chain_id: 2,
              completed: false,
              confirmations: 1,
              date: new Date(),
              id: 1,
              quantity: `124.0000 ${token_symbol}`,
              ref: '1111111111111111111111111111111111111111111111111111111111111112',
              to: sender1.name,
            },
          ])
        })
      })
    })
  })

  // Teleport
  context('teleport', async () => {
    context('without valid auth', async () => {
      it('should fail with auth error', async () => {
        await assertMissingAuthority(
          teleporteos.teleport(sender1.name, `123.0000 ${token_symbol}`, 2, ethToken, {
            from: sender2,
          })
        )
      })
    })
    context('with valid auth', async () => {
      context('with invalid quantity', async () => {
        it('should fail with valid error', async () => {
          await assertEOSErrorIncludesMessage(
            teleporteos.teleport(sender1.name, '123.0000', 2, ethToken, {
              from: sender1,
            }),
            'Amount is not valid'
          )
        })
      })
      context('with amount below minimum', async () => {
        it('should fail with below min error error', async () => {
          await assertEOSErrorIncludesMessage(
            teleporteos.teleport(sender1.name, `23.0000 ${token_symbol}`, 2, ethToken, {
              from: sender1,
            }),
            'Transfer is below minimum token amount'
          )
        })
      })
      context('with no available deposit', async () => {
        it('should fail with no deposit error', async () => {
          await assertEOSErrorIncludesMessage(
            teleporteos.teleport(sender1.name, `123.0000 ${token_symbol}`, 2, ethToken, {
              from: sender1,
            }),
            'Deposit not found'
          )
        })
      })
      context('with not enough deposit', async () => {
        before(async () => {
          await alienworldsToken.transfer(
            sender1.name,
            teleporteos.account.name,
            `120.0000 ${token_symbol}`,
            'teleport test',
            { from: sender1 }
          )
        })
        it('should fail with not enough deposit error', async () => {
          await assertEOSErrorIncludesMessage(
            teleporteos.teleport(sender1.name, `123.0000 ${token_symbol}`, 2, ethToken, {
              from: sender1,
            }),
            'Not enough deposited'
          )
        })
      })
      context('with enough deposit', async () => {
        before(async () => {
          await alienworldsToken.transfer(
            sender1.name,
            teleporteos.account.name,
            `104.0000 ${token_symbol}`,
            'teleport test extra amount',
            { from: sender1 }
          )
        })
        it('should succeed', async () => {
          await teleporteos.teleport(
            sender1.name,
            `123.0000 ${token_symbol}`,
            2,
            ethToken,
            { from: sender1 }
          )
        })
        it('should update teleports table', async () => {
          let { rows: [item] } = await teleporteos.teleportsTable()
          chai.expect(item.account).equal(sender1.name)
          chai.expect(item.chain_id).equal(2)
          chai.expect(item.id).equal(0)
          chai.expect(item.quantity).equal(`123.0000 ${token_symbol}`)
          chai.expect(item.eth_address).equal(ethToken)
          chai.expect(item.oracles).empty
          chai.expect(item.signatures).empty
          chai.expect(item.claimed).false
        })
      })
    })
  })

  // Sign
  context('sign teleport', async () => {
    context('with incorrect auth', async () => {
      it('should fail', async () => {
        await assertMissingAuthority(
          teleporteos.sign(oracle1.name, 0, 'abcdefghijklmnopabcdefghijklmnopabcdefghijklmnop', { from: sender1 })
        )
        await assertMissingAuthority(
          teleporteos.sign(oracle1.name, 0, 'abcdefghijklmnopabcdefghijklmnopabcdefghijklmnop', { from: oracle2 })
        )
      })
    })
    context('with correct auth', async () => {
      it('wrong parameters', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.sign(oracle1.name, 10, 'abcdefghijklmnopabcdefghijklmnopabcdefghijklmnop', { from: oracle1 }),
          'Teleport not found'
        )
      })
      it('should succeed', async () => {
        await teleporteos.sign(oracle1.name, 0, 'abcdefghijklmnopabcdefghijklmnopabcdefghijklmnop', { from: oracle1 })
        const { rows: [item] } = await teleporteos.teleportsTable({lowerBound: '0'})
        chai.expect(item.id).equal(0, 'Wrong id')
        chai.expect(item.oracles.length).equal(1, 'Wrong sign amount of oracles')
        chai.expect(item.oracles[0]).equal(oracle1.name, 'Wrong oracle')
      })
      it('refuse double signing', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.sign(oracle1.name, 0, 'abc', { from: oracle1 }),
          'Oracle has already signed'
        )
      })
      it('refuse same signature', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.sign(oracle2.name, 0, 'abcdefghijklmnopabcdefghijklmnopabcdefghijklmnop', { from: oracle2 }),
          'Already signed with this signature'
        )
      })
    })
  })
  
  // Teleport claimed
  context('set teleport claimed', async () => {
    context('with incorrect auth', async () => {
      it('should fail', async () => {
        await assertMissingAuthority(
          teleporteos.claimed(oracle1.name, 0, ethToken, `123.0000 ${token_symbol}`, { from: sender1 })
        )
      })
    })
    context('with correct auth', async () => {
      context('wrong parameters', async () => {
        it('should fail', async () => {
          await assertEOSErrorIncludesMessage(
            teleporteos.claimed(oracle1.name, 10, ethToken, `123.0000 ${token_symbol}`, { from: oracle1 }),
            'Teleport not found'
          )
          await assertEOSErrorIncludesMessage(
            teleporteos.claimed(oracle1.name, 0, ethToken, `1.0000 ${token_symbol}`, { from: oracle1 }),
            'Quantity mismatch'
          )
        })
      })
      context('correct parameters', async () => {
        it('should succeed', async () => {
          await teleporteos.claimed(oracle1.name, 0, ethToken, `123.0000 ${token_symbol}`, { from: oracle1 })
          const { rows: [item] } = await teleporteos.teleportsTable({lowerBound: '0'})
          chai.expect(item.id).equal(0, 'Wrong id')
          chai.expect(item.claimed).equal(true)
        })
        it('should refuse double claiming', async () => {
          await assertEOSErrorIncludesMessage(
            teleporteos.claimed(oracle1.name, 0, ethToken, `123.0000 ${token_symbol}`, { from: oracle1 }),
            'Already marked as claimed'
          )
        })
      })
    })
  })

  // Adjust minimum amount
  context('adjust minimum amount', async () => {
    context('with incorrect auth', async () => {
      it('should fail with auth error', async () => {
        await assertMissingAuthority(
          teleporteos.setmin(`200.0000 ${token_symbol}`, { from: sender1 })
        )
      })
    })
    context('with correct auth', async () => {
      it('wrong symbol name should fail', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.setmin(`200.0000 ${token_symbol.length <= 3? token_symbol + 'A': 'AAA'}`, { from: teleporteos.account }),
          'Wrong token'
        )
      })
        it('wrong symbol precision should fail', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.setmin(`200 ${token_symbol}`, { from: teleporteos.account }),
          'Wrong token'
        )
      })
      it('should succeed', async () => {
        await teleporteos.setmin(`200.0000 ${token_symbol}`, { from: teleporteos.account })
      })
      it('should update threshold', async () => {
        let { rows: [item] } = await teleporteos.statsTable()
        chai.expect(item.min).equal(2000000)
      })
    })
  })

  // Adjust fee
  const fixfee = BigInt(1102)
  context('adjust fee', async () => {
    context('with incorrect auth', async () => {
      it('should fail with auth error', async () => {
        await assertMissingAuthority(
          teleporteos.setfee(amountToAsset(fixfee, token_symbol, 4), '0.007', { from: sender1 })
        )
      })
    })
    context('with correct auth', async () => {
      context('with wrong variable fee', async () => {
        it('should fail', async () => {
          await assertEOSErrorIncludesMessage(
            teleporteos.setfee(`0.0000 ${token_symbol}`, '-0.01', { from: teleporteos.account }),
            'Variable fee has to be between 0 and 0.20'
          )
        })
        it('should fail', async () => {
          await assertEOSErrorIncludesMessage(
            teleporteos.setfee(`0.0000 ${token_symbol}`, '1', { from: teleporteos.account }),
            'Variable fee has to be between 0 and 0.20'
          )
        })     
      })
      context('with wrong fix fee', async () => {
        it('wrong symbol name should fail', async () => {
          await assertEOSErrorIncludesMessage(
            teleporteos.setfee(`0.0001 ${token_symbol.length <= 3? token_symbol + 'A': 'AAA'}`, '0', { from: teleporteos.account }),
            'Wrong token'
          )
        })
        it('wrong symbol precision should fail', async () => {
          await assertEOSErrorIncludesMessage(
            teleporteos.setfee(`1 ${token_symbol}`, '0.007', { from: teleporteos.account }),
            'Wrong token'
          )
        })
        it('too high amount should fail', async () => {
          await assertEOSErrorIncludesMessage(
            teleporteos.setfee(`200.0000 ${token_symbol}`, '0.007', { from: teleporteos.account }),
            'Fees are too high relative to the minimum amount of token transfers'
          )
        })  
      })
      context('with valid fees', async () => {
        it('should succeed', async () => {
          await teleporteos.setfee(amountToAsset(fixfee, token_symbol, 4), '0.007', { from: teleporteos.account })
        })
        it('should update stats table', async () => {
          let { rows: [item] } = await teleporteos.statsTable()
          chai.expect(BigInt(item.fixfee)).equal(fixfee, 'Wrong fix fee')
          chai.expect(item.varfee).equal('0.00700000000000000', 'Wrong variable fee')
        })
        it('should succeed withdraw and deposit', async () => {
          await teleporteos.withdraw(sender1.name, `1.0000 ${token_symbol}`, { from: sender1 })
          {
            let { rows } = await teleporteos.depositsTable()
            for(let item of rows){
              if(item.account == sender1.name){
                chai.expect(item.quantity).equal(`100.0000 ${token_symbol}`, 'Wrong deposit on withdraw')
                break
              }
            }
          }
          let { rows: [item_balance] } = await alienworldsToken.accountsTable({scope: sender1.name})
          chai.expect(item_balance.balance).equal(`999900.0000 ${token_symbol}`, 'Wrong balance after withdraw')
          await alienworldsToken.transfer(
            sender1.name,
            teleporteos.account.name,
            `200.0000 ${token_symbol}`,
            'teleport test',
            { from: sender1 }
          )
          let deposits = await teleporteos.depositsTable()
          for(let item of deposits.rows){
            if(item.account == sender1.name){
              chai.expect(item.quantity).equal(`300.0000 ${token_symbol}`, 'Wrong balance on deposit')
              break
            }
          }
        })
        it('should succeed teleport', async () => {
          await teleporteos.teleport(sender1.name, `200.0000 ${token_symbol}`, 2, ethToken, { from: sender1 })
        })
        it('should have listed last teleport in table', async () => {
          let deposits = await teleporteos.depositsTable()
          for(let item of deposits.rows){
            if(item.account == sender1.name){
              chai.expect(item.quantity).equal(`100.0000 ${token_symbol}`, 'Wrong balance on deposit')
              break
            }
          }
          // Check collected amount
          const value = BigInt(2000000)
          const fee = calcFee(value, fixfee, 0.007)
          let { rows: [stat] } = await teleporteos.statsTable()
          chai.expect(stat.collected.toString()).equal(fee.toString(), "Wrong collected fee amount")
          // Check teleport amount 
          let teleports = await teleporteos.teleportsTable({reverse: true})
          chai.expect(teleports.rows[0].quantity).equal(amountToAsset(value - fee, token_symbol, 4), "Wrong fee calculation")
        })
        context('valid received until confirmation', async () => {
          let sender1Balance: bigint;
          let sender1DepositBalance: bigint;
          let oldStat: TeleporteosStatsItem
          const hash = '1111111111111111111111111111111111111111111111111111111111111113'
          const sendAmount = BigInt(1230)
          const sendAsset = amountToAsset(sendAmount, token_symbol, 4)
          before(async () => {
            // Get current balance of sender 1 on token contract
            let { rows: [a_item_old] } = await alienworldsToken.accountsTable({scope: sender1.name})
            sender1Balance = stringToAsset(a_item_old.balance).amount
            // Get current balance of sender 1 on deposits
            sender1DepositBalance = BigInt(0)
            let deposits_old = await teleporteos.depositsTable()
            for(let item of deposits_old.rows){
              if(item.account == sender1.name){
                sender1DepositBalance = stringToAsset(item.quantity).amount
                break
              }
            }
            // Get current stat
            let stats = await teleporteos.statsTable()
            oldStat = stats.rows[0] 
          })
          it('should succeed', async () => {
            // Send received action by three oracles, so it should be completed
            await teleporteos.received(
              oracle1.name, sender1.name, hash, sendAsset, 2, true, { from: oracle1 }
            )
            await teleporteos.received(
              oracle2.name, sender1.name, hash, sendAsset, 2, true, { from: oracle2 }
            )
            await teleporteos.received(
              oracle3.name, sender1.name, hash, sendAsset, 2, true, { from: oracle3 }
            )
          })
          it('should have expected table entries', async () => {
            let { rows: [confirmedItem] } = await teleporteos.receiptsTable({
              keyType: 'sha256', 
              indexPosition: 2, 
              lowerBound: hash
            })
            chai.expect(confirmedItem.confirmations).equal(3, "Wrong amount of confirmations")
            chai.expect(confirmedItem.completed).equal(true, "Not completed") 
            // Check collected
            const fee = calcFee(sendAmount, fixfee, 0.007)
            let { rows: [stat_new] } = await teleporteos.statsTable()
            chai.expect(stat_new.collected.toString()).equal((BigInt(oldStat.collected) + fee).toString(), "Collected got wrong amount of fees")
            // Check new balance on token contract
            let { rows: [a_item_new] } = await alienworldsToken.accountsTable({scope: sender1.name})
            chai.expect(stringToAsset(a_item_new.balance).amount.toString()).equal((sender1Balance + sendAmount - fee).toString(), "New Balance reduced by a fee is wrong")
            // Check if deposit table is unchanged
            let deposits_new = await teleporteos.depositsTable()
            for(let item of deposits_new.rows){
              if(item.account == sender1.name){
                chai.expect(stringToAsset(item.quantity).amount.toString()).equal(sender1DepositBalance.toString(), "Deposit has changed")
                break
              }
            }
          })
        })
      })
    })
  })

  // Adjust threshold
  context('adjust threshold', async () => {
    context('with incorrect auth', async () => {
      it('should fail with auth error', async () => {
        await assertMissingAuthority(
          teleporteos.setthreshold(2, { from: sender1 })
        )
      })
    })
    context('with correct auth', async () => {
      it('and incorrect amount should fail', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.setthreshold(0, { from: teleporteos.account }),
          'Needed confirmation amount has to be grater than 0'
        )
      })
      it('should succeed receipt', async () => {
        // Set threshold to 2
        await teleporteos.setthreshold(2, { from: teleporteos.account })
        // Check stats
        let { rows: [stat] } = await teleporteos.statsTable()
        chai.expect(stat.threshold).equal(2, "Threshold was not inherited")
        // Send received action by three oracles, so it should be completed
        const hash = '1111111111111111111111111111111111111111111111111111111111111114'
        const sendAmount = BigInt(10000)
        const sendAsset = amountToAsset(sendAmount, token_symbol, 4)
        // Execute recepits by one oracles
        await teleporteos.received(
          oracle1.name, sender1.name, hash, sendAsset, 1, true, { from: oracle1 }
        )
        let { rows: [unconfItem] } = await teleporteos.receiptsTable({
          keyType: 'sha256', 
          indexPosition: 2,
          lowerBound: hash
        })
        chai.expect(unconfItem.confirmations).equal(1, "Wrong amount of confirmations")
        chai.expect(unconfItem.completed).equal(false, "Is completed")
        // Execute recepits by a second oracles
        await teleporteos.received(
          oracle2.name, sender1.name, hash, sendAsset, 1, true, { from: oracle2 }
        )
        let { rows: [confItem] } = await teleporteos.receiptsTable({
          keyType: 'sha256', 
          indexPosition: 2, 
          lowerBound: hash
        })
        chai.expect(confItem.confirmations).equal(2, "Wrong amount of confirmations")
        chai.expect(confItem.completed).equal(true, "Is not completed")
        
        // Execute recepits by a third oracles
        await assertEOSErrorIncludesMessage(
          teleporteos.received(oracle3.name, sender1.name, hash, sendAsset, 1, true, { from: oracle3 }), 
          'This teleport is already completed'
        )
      })
    })
  })

  // Delete teleports
  context('delete teleports', async () => {
    it('with incorrect auth should fail with auth error', async () => {
      await assertMissingAuthority(
        teleporteos.delteles('0', { from: sender1 })
      )
      await assertMissingAuthority(
        teleporteos.delteles('0', { from: oracle1 })
      )
    })
    it('with not available id should fail', async () => {
      await assertEOSErrorIncludesMessage(
        teleporteos.delteles('100', { from: teleporteos.account }), 
        'Teleport id not found'
      )
    })
    it('preparation', async () => {
      // Add three teleports
      await teleporteos.teleport(alienworldsToken.account.name, `203.0000 ${token_symbol}`, 1, ethToken, { from: alienworldsToken.account })
      await teleporteos.teleport(alienworldsToken.account.name, `203.0000 ${token_symbol}`, 2, ethToken, { from: alienworldsToken.account })
      await teleporteos.teleport(alienworldsToken.account.name, `203.0000 ${token_symbol}`, 3, ethToken, { from: alienworldsToken.account })
      const fee = calcFee(BigInt(2030000), fixfee, 0.007)
      const sendAsset = amountToAsset(BigInt(2030000) - fee, token_symbol, 4)
      // Claim all teleports but not the second in table 
      await teleporteos.claimed(oracle1.name, 2, ethToken, sendAsset, { from: oracle1 })
      await teleporteos.claimed(oracle1.name, 3, ethToken, sendAsset, { from: oracle1 })
      await teleporteos.claimed(oracle1.name, 4, ethToken, sendAsset, { from: oracle1 })
    })
    context('with correct auth', async () => {
      context('delete to id 2', async () => {
        it('should succeed', async () => {
          // Delete until the third one
          await teleporteos.delteles('2', { from: teleporteos.account })
          const teleports = await teleporteos.teleportsTable()
          chai.expect(teleports.rows.length).equal(4, 'Wrong amount of teleports are deleted')
          chai.expect(teleports.rows[0].id).equal(1, 'Wrong deletion')
          chai.expect(teleports.rows[1].id).equal(2, 'Wrong deletion')
          chai.expect(teleports.rows[2].id).equal(3, 'Wrong deletion')
          chai.expect(teleports.rows[3].id).equal(4, 'Wrong deletion')
        })
      })
      context('delete to last id', async () => {
        it('should fail', async () => {
          await assertEOSErrorIncludesMessage(
            teleporteos.delteles('5', { from: teleporteos.account }), 
            'Teleport id not found'
          )
        })
        it('should succeed', async () => {
          // Delete until the third one
          await teleporteos.delteles('4', { from: teleporteos.account })
          const teleports = await teleporteos.teleportsTable()
          chai.expect(teleports.rows.length).equal(2, 'Wrong amount of teleports are deleted')
          chai.expect(teleports.rows[0].id).equal(1, 'Wrong deletion')
          chai.expect(teleports.rows[1].id).equal(4, 'Wrong deletion')
        })
      })
    })
  })

  // Cancel action
  context('cancel teleport', async () => {
    context('with incorrect auth', async () => {
      it('should fail with auth error', async () => {
        await assertMissingAuthority(
          teleporteos.cancel('1', { from: oracle1 })
        )
      })
    })
    context('with correct auth', async () => {
      it('should fail when it is claimed', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.cancel('4', { from: alienworldsToken.account }),
          'Teleport is already claimed'
        )
      })
      it('should fail when it is too early', async () => {
        await assertEOSErrorIncludesMessage(
          teleporteos.cancel('1', { from: sender1 }),
          'Teleport has not expired'
        )
      })
    })
  })

  // Pay oracles
  context('pay oracles', async () => {
    it('should succeed', async () => {
      const {rows: [initialStat]} = await teleporteos.statsTable()
      const amountPerOracle = BigInt(Math.floor(Number(initialStat.collected) / initialStat.oracles))
      const rest = BigInt(initialStat.collected) - (amountPerOracle * BigInt(initialStat.oracles))
      await teleporteos.payoracles({ from: sender1 })
      // Check rest
      const {rows: [stat]} = await teleporteos.statsTable()
      chai.expect(BigInt(stat.collected)).equal(rest, 'Wrong collected rest')
      // Check oracle deposit amounts
      const deposits = await teleporteos.depositsTable({lowerBound: oracle1.name})
      chai.expect(stringToAsset(deposits.rows[0].quantity).amount).equal(amountPerOracle, 'Wrong amount for oracle')
      chai.expect(stringToAsset(deposits.rows[1].quantity).amount).equal(amountPerOracle, 'Wrong amount for oracle')
      chai.expect(stringToAsset(deposits.rows[2].quantity).amount).equal(amountPerOracle, 'Wrong amount for oracle')
    })
  })

  // Delete receipts
  context('delete receipts', async () => {
    let initialReceipts; 
    let lastDate: Date;
    let second: Date;
    it('get initial receipt table', async () => {
      initialReceipts = await teleporteos.receiptsTable()
      lastDate = fixLamingtionDate(initialReceipts.rows[initialReceipts.rows.length - 1].date)
      second = fixLamingtionDate(initialReceipts.rows[1].date)
    })
    it('with user auth should fail with auth error', async () => {
      await assertMissingAuthority(
        teleporteos.delreceipts(lastDate, { from: sender1 })
        )
    })
    it('with oracle auth should fail with auth error', async () => {
      await assertMissingAuthority(
          teleporteos.delreceipts(lastDate, { from: oracle1 })
      )
    })
    it('with correct auth delete to id 2 should succeed', async () => {
      // Delete until the third one
        await teleporteos.delreceipts(second, { from: teleporteos.account })
        const receipts = await teleporteos.receiptsTable()
        chai.expect(receipts.rows.length).equal(3, 'Wrong amount of receipts are deleted')
        chai.expect(receipts.rows[0].id).equal(1, 'Wrong deletion')
        chai.expect(receipts.rows[1].id).equal(2, 'Wrong deletion')
        chai.expect(receipts.rows[2].id).equal(3, 'Wrong deletion')
    })
    it('with correct auth delete all should succeed', async () => {
      // Delete until the third one
      await teleporteos.delreceipts(new Date(lastDate.getTime() + 1000), { from: teleporteos.account })
      const receipts = await teleporteos.receiptsTable()
      chai.expect(receipts.rows.length).equal(0, 'Not all deleted')
    })
  })
})

async function seedAccounts() {
  teleporteos = await ContractDeployer.deployWithName<Teleporteos>(
    'contracts/teleport/teleporteos',
    'teleporteos'
  )

  alienworldsToken = await ContractDeployer.deployWithName<EosioToken>(
    'contracts/eosio.token/eosio.token',
    'alien.worlds'
  )

  sender1 = await AccountManager.createAccount('sender1')
  sender2 = await AccountManager.createAccount('sender2')
  oracle1 = await AccountManager.createAccount('oracle1')
  oracle2 = await AccountManager.createAccount('oracle2')
  oracle3 = await AccountManager.createAccount('oracle3')
  oracle4 = await AccountManager.createAccount('oracle4')

  await issueTokens()
  await updateAuths()
}

async function updateAuths() {
  await UpdateAuth.execUpdateAuth(
    [{ actor: teleporteos.account.name, permission: 'owner' }],
    teleporteos.account.name,
    'active',
    'owner',
    UpdateAuth.AuthorityToSet.explicitAuthorities(
      1,
      [
        {
          permission: {
            actor: teleporteos.account.name,
            permission: 'eosio.code',
          },
          weight: 1,
        },
      ],
      [{ key: teleporteos.account.publicKey!, weight: 1 }]
    )
  )

  // await UpdateAuth.execLinkAuth(
  //   landholders.account.active,
  //   landholders.account.name,
  //   eosioToken.account.name,
  //   'transfer',
  //   'distribpay'
  // )
}

async function issueTokens() {
  try {
    await alienworldsToken.create(
      alienworldsToken.account.name,
      `1000000000.0000 ${token_symbol}`,
      { from: alienworldsToken.account }
    )

    await alienworldsToken.issue(
      alienworldsToken.account.name,
      `10000000.0000 ${token_symbol}`,
      'initial deposit',
      { from: alienworldsToken.account }
    )
  } catch (e) {
    if ((e as { json: {error: {what: string } } }).json.error.what != 'eosio_assert_message assertion failure') {
      throw e
    }
  }

  await alienworldsToken.transfer(
    alienworldsToken.account.name,
    sender1.name,
    `1000000.0000 ${token_symbol}`,
    'inital balance',
    { from: alienworldsToken.account }
  )

  await alienworldsToken.transfer(
    alienworldsToken.account.name,
    teleporteos.account.name,
    `1000000.0000 ${token_symbol}`,
    'inital balance',
    { from: alienworldsToken.account }
  )
}

function amountToAsset(amount: bigint, symbol_name: string, precision: number){
  let s = amount.toString().padStart(precision, '0')
  let p = s.length - precision
  let int = s.substring(0, p)
  return `${int? int : '0'}${'.'}${s.substring(p)} ${symbol_name}` 
}

function stringToAsset(asset_str: string){
  let s = asset_str.indexOf('.')
  let e = asset_str.indexOf(' ', s)
  let precision = e - s
  let name = asset_str.substring(e + 1).trim()
  let amount =  BigInt(asset_str.substring(0, s) + asset_str.substring(s + 1, e))
  return {amount, symbol: {precision, name}}
}

function calcFee(amount: bigint, fixfeeAmount: bigint, varfee: number){
  return BigInt(Math.floor(Number(amount) * varfee)) + fixfeeAmount
}

function fixLamingtionDate(date: Date){
  // Lamington converts the date wrong. This will fix it
  const offset = (new Date()).getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() + offset)

  // let d = correctedDate.toString()
  // const ms = d.indexOf('.')
  // if(ms != -1){
  //   return d.substring(0, ms)
  // }
  // return d
}