
Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Lightning Map Game is a real-time lightning prediction game built with Next.js, React Three Fiber, and Zustand. 

## Features

- **Live 3D Globe:** Built with `@react-three/fiber` and `three.js` to visualize global lightning strikes as they happen.
- **Interactive Betting Zones:** The Earth is divided into 162 distinct zones. Click any zone to view real-time strike stats and place your predictions.
- **Dynamic Multipliers:** Zone payouts shift dynamically based on live weather activity—calm zones pay more, while active storm zones pay less.
- **Real-Time Sync:** Powered by WebSockets to stream live strike data, update grid multipliers, and resolve bets instantly.

Transform global weather patterns into a thrilling, interactive prediction experience!


This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```
