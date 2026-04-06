import { registerAs } from '@nestjs/config';

export default registerAs('stellar', () => {
  const network = process.env.STELLAR_NETWORK ?? 'testnet';
  const isTestnet = network === 'testnet';

  return {
    network,
    horizonUrl: process.env.STELLAR_HORIZON_URL ?? (isTestnet
      ? 'https://horizon-testnet.stellar.org'
      : 'https://horizon.stellar.org'),
    sorobanRpcUrl: process.env.SOROBAN_RPC_URL ?? (isTestnet
      ? 'https://soroban-testnet.stellar.org'
      : 'https://soroban-rpc.stellar.org'),
    networkPassphrase: isTestnet
      ? 'Test SDF Network ; September 2015'
      : 'Public Global Stellar Network ; September 2015',
  };
});
