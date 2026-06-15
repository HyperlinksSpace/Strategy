/**
 * Hyperlinks Space — site settings
 * Edit texts and links here. Loaded before app.js.
 */
(function () {
  'use strict';

  window.HLS_SETTINGS = {
    promo: {
      headerLabel: 'Promo',
      badge: 'Live · Promo',
      title: 'Hyperlinks Space Program',
      url: 'https://www.hyperlinks.space/',
      urlLabel: 'hyperlinks.space',
      description:
        'AI & blockchain multiplatform for managing, investing, and earning assets — recommendations, chats, swaps, trades, wallets, and deals. AI Transmitter reads chain data in real time.',
      features: ['Wallets & swaps', 'AI Transmitter', 'Cross-chain deals'],
      cta: 'Open hyperlinks.space'
    },

    headerNav: [
      { id: 'tech', label: 'Tech' },
      { id: 'research', label: 'Research' },
      { id: 'products', label: 'Products' }
    ],

    products: [
      {
        id: 'hsp',
        name: 'Hyperlinks Space Program',
        tagline: 'AI & blockchain multiplatform',
        description:
          'Managing, investing, and earning on assets — recommendations, chats, swaps, trades, wallets, and deals. AI Transmitter reads blockchain data in real time.',
        links: [
          { label: 'Live product', url: 'https://www.hyperlinks.space/' },
          { label: 'GitHub', url: 'https://github.com/HyperlinksSpace/HyperlinksSpaceProgram' }
        ]
      },
      {
        id: 'aityuahn',
        name: 'AityUahn',
        tagline: 'Build with Agentic AI — fully automated',
        description:
          'Agentic AI development platform for automated software creation. Research direction for autonomous engineering pipelines.',
        links: [
          { label: 'GitHub', url: 'https://github.com/HyperlinksSpace/AityUahn' }
        ]
      },
      {
        id: 'whatswap',
        name: 'WhatSwap',
        tagline: 'What Swap — Best Price',
        description:
          'Cross-chain and jetton swap aggregator for TON ecosystem. Finds best prices across liquidity sources.',
        links: [
          { label: 'GitHub', url: 'https://github.com/HyperlinksSpace/whatswap' },
          { label: 'Swap front', url: 'https://github.com/HyperlinksSpace/swap-front' }
        ]
      }
    ],

    research: [
      {
        id: 'blockchain',
        name: 'Blockchain & TON Architecture',
        description: 'Smart contracts, tokenized backends, stablecoins, NFT infrastructure, and on-chain deal history.',
        links: [
          { label: 'BlockchainProgram', url: 'https://github.com/HyperlinksSpace/BlockchainProgram' },
          { label: 'stablecoin-blueprint', url: 'https://github.com/HyperlinksSpace/stablecoin-blueprint' },
          { label: 'ton-nft-dapp', url: 'https://github.com/HyperlinksSpace/ton-nft-dapp' }
        ]
      },
      {
        id: 'edge-ai',
        name: 'Edge AI & TinyModel',
        description: 'Universal brain — distributed inference, model sharding, and edge-native AI on consumer hardware.',
        links: [
          { label: 'TinyModel', url: 'https://github.com/HyperlinksSpace/TinyModel' }
        ]
      },
      {
        id: 'agentic-ai',
        name: 'Agentic AI Automation',
        description: 'Fully automated software engineering with agentic AI pipelines and autonomous build systems.',
        links: [
          { label: 'AityUahn', url: 'https://github.com/HyperlinksSpace/AityUahn' }
        ]
      },
      {
        id: 'ai-blockchain',
        name: 'AI Blockchain Networks',
        description: 'Cognitive bridges synchronizing data across fragmented networks under stress and delay.',
        links: [
          { label: 'STUN', url: 'https://github.com/HyperlinksSpace/STUN' }
        ]
      },
      {
        id: 'freelance-dao',
        name: 'Tokenized Freelance & DAO',
        description: 'Smart-contract-secured deals, on-chain work history, and decentralized labor markets on TON.',
        links: [
          { label: 'freelance-exchange-tdb', url: 'https://github.com/HyperlinksSpace/freelance-exchange-tdb' },
          { label: 'a-tokenized-freelance-exchange', url: 'https://github.com/HyperlinksSpace/a-tokenized-freelance-exchange' },
          { label: 'freelancer-dao-contract', url: 'https://github.com/HyperlinksSpace/freelancer-dao-contract' }
        ]
      },
      {
        id: 'space-infra',
        name: 'Interplanetary Infrastructure',
        description: 'DTN bundle protocol, CRDT state graphs, and protocol standards for Earth–space coordination.',
        links: [
          { label: 'Strategy (this site)', url: 'https://github.com/HyperlinksSpace/Strategy' },
          { label: 'world2040', url: 'https://github.com/HyperlinksSpace/world2040' }
        ]
      }
    ],

    tech: {
      existing: [
        {
          id: 'ton',
          name: 'TON Blockchain',
          description: 'Smart contracts, jettons, TON Connect, and Telegram Mini App integration.',
          links: [
            { label: 'hello-frontend', url: 'https://github.com/HyperlinksSpace/hello-frontend' },
            { label: 'ton-router', url: 'https://github.com/HyperlinksSpace/ton-router' }
          ]
        },
        {
          id: 'typescript',
          name: 'TypeScript / Web Stack',
          description: 'Frontends, APIs, TMA templates, and multi-platform web clients.',
          links: [
            { label: 'HyperlinksSpaceProgram', url: 'https://github.com/HyperlinksSpace/HyperlinksSpaceProgram' },
            { label: 'some-tma-template', url: 'https://github.com/HyperlinksSpace/some-tma-template' }
          ]
        },
        {
          id: 'smart-contracts',
          name: 'Smart Contracts (FunC / Tact / Solidity)',
          description: 'On-chain swaps, NFT minters, DAO contracts, and payment counters.',
          links: [
            { label: 'UniversalMultiSender', url: 'https://github.com/HyperlinksSpace/UniversalMultiSender' },
            { label: 'a-wallet-swap-smart-contract', url: 'https://github.com/HyperlinksSpace/a-wallet-swap-smart-contract' }
          ]
        },
        {
          id: 'ai-ml',
          name: 'AI / ML (Python & Edge)',
          description: 'TinyModel edge runtime prototype, research simulations, and AI transmitters.',
          links: [
            { label: 'TinyModel', url: 'https://github.com/HyperlinksSpace/TinyModel' },
            { label: 'STUN', url: 'https://github.com/HyperlinksSpace/STUN' }
          ]
        },
        {
          id: 'telegram',
          name: 'Telegram Mini Apps & Bots',
          description: 'TMA wallets, swap bots, careers bots, and in-chat commerce.',
          links: [
            { label: 'aWallet', url: 'https://github.com/HyperlinksSpace/aWallet' },
            { label: 'swap-bot', url: 'https://github.com/HyperlinksSpace/swap-bot' }
          ]
        },
        {
          id: 'unity',
          name: 'Unity / Game Integration',
          description: 'TON ecosystem connectivity inside Unity web applications.',
          links: [
            { label: 'Veittech-UnitonConnect', url: 'https://github.com/HyperlinksSpace/Veittech-UnitonConnect' }
          ]
        }
      ],
      planned: [
        {
          id: 'rust-core',
          name: 'Rust / C++ / Zig Core Runtime',
          description: 'Zero-dependency autonomous runtime with embedded CRDTs and protocol bridges.',
          links: []
        },
        {
          id: 'mqtt',
          name: 'MQTT Broker',
          description: '2-byte header pub/sub for M2M telemetry over lossy satellite and industrial EM environments.',
          links: []
        },
        {
          id: 'opcua',
          name: 'OPC UA Bridge',
          description: 'Industrial semantics bridge for Siemens, ABB, Schneider controllers.',
          links: []
        },
        {
          id: 'dtn',
          name: 'DTN Bundle Protocol',
          description: 'NASA store-and-forward networking for Earth–Mars links and solar conjunction gaps.',
          links: []
        },
        {
          id: 'crdt',
          name: 'CRDT Engine',
          description: 'Conflict-free replicated state for nodes millions of kilometers apart.',
          links: []
        },
        {
          id: 'neuromorphic',
          name: 'Neuromorphic Edge Firmware',
          description: 'Reference silicon specs and firmware for protocol-native edge chips.',
          links: []
        }
      ]
    },

    heroActions: [
      { label: 'Explore Roadmap', href: '#roadmap', style: 'primary', i18n: 'hero.cta1' },
      { label: 'Open hyperlinks.space', href: 'https://www.hyperlinks.space/', style: 'promo', external: true, i18n: 'promo.cta' },
      { label: 'GitHub Organization', href: 'https://github.com/HyperlinksSpace', style: 'ghost', external: true, i18n: 'hero.cta2' }
    ],

    aiChat: {
      enabled: true,
      endpoint: 'https://www.hyperlinks.space/api/ai',
      preferSameOrigin: true,
      format: 'hsp',
      mode: 'chat',
      maxHistory: 12,
      model: 'gpt-4o-mini',
      apiKey: '',
      instructions: {
        en:
          'You are AI CORE, a knowledgeable general-purpose assistant. Answer questions on any topic clearly, accurately, and professionally in English. You are shown on the Hyperlinks Space strategy website; when users ask about Hyperlinks Space, its protocols, roadmap, or products, you may use that context. For site navigation they can also say section names such as Vision, Pillars, Roadmap, or ask for a guided tour. Keep answers concise for voice (two to five sentences) unless the user asks for more detail.',
        ru:
          'Вы — AI CORE, универсальный помощник. Отвечайте на любые вопросы ясно, точно и профессионально на русском языке. Вы на сайте стратегии Hyperlinks Space; при вопросах о компании, протоколах или roadmap используйте этот контекст. Для навигации пользователь может назвать раздел (Видение, Столпы, Дорожная карта) или попросить тур. Краткие ответы для голоса (2–5 предложений), если не просят подробнее.',
        zh:
          '你是 AI CORE，通用智能助手。用中文清晰、准确、专业地回答任何领域的问题。你位于 Hyperlinks Space 战略网站；若用户询问该公司、协议或路线图，可结合该背景。导航可说章节名（愿景、支柱、路线图）或请求导览。语音场景下回答宜简洁（2–5 句），除非用户要求更详细。'
      }
    },

    dropdownIntros: {
      products: 'Live platforms that fund Earth operations while the interplanetary protocol stack matures.',
      research: 'Research aligned with the long-term strategy — blockchain infrastructure, edge AI, agentic automation, and deep-space networking.',
      tech: 'Production systems in use today and hardened protocols under development for industrial and orbital scale.'
    }
  };
})();
