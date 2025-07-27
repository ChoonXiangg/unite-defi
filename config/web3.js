import { createWeb3Modal } from '@web3modal/wagmi'
import { defaultWagmiConfig } from '@web3modal/wagmi'
import { mainnet, polygon, arbitrum, optimism } from 'wagmi/chains'

export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID || 'your-project-id'

export const etherlinkChain = {
  id: 42793,
  name: 'Etherlink Mainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Tezos',
    symbol: 'XTZ',
  },
  rpcUrls: {
    default: {
      http: ['https://node.mainnet.etherlink.com'],
    },
  },
  blockExplorers: {
    default: { name: 'Etherlink Explorer', url: 'https://explorer.etherlink.com' },
  },
}

const metadata = {
  name: 'Unite DeFi',
  description: 'Web3 Swap App with Token Rewards',
  url: 'https://unite-defi.com',
  icons: ['https://avatars.githubusercontent.com/u/37784886']
}

const chains = [mainnet, polygon, arbitrum, optimism, etherlinkChain]

export const config = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
  enableEmail: true,
})

createWeb3Modal({
  wagmiConfig: config,
  projectId,
  enableAnalytics: true,
})