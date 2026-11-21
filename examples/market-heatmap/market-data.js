export const BASE_MARKET = [
  {
    id: "technology",
    name: "فناوری",
    color: "#17253a",
    stocks: [
      ["NVDA", "NVIDIA", 3120, 184.36, 3.84, 221_400_000],
      ["MSFT", "Microsoft", 2950, 407.12, 1.28, 18_900_000],
      ["AAPL", "Apple", 2870, 239.54, -0.72, 51_200_000],
      ["AVGO", "Broadcom", 1380, 351.84, 2.16, 27_800_000],
      ["ORCL", "Oracle", 650, 294.18, -1.14, 13_200_000],
      ["CRM", "Salesforce", 255, 268.42, 0.64, 8_900_000],
    ],
  },
  {
    id: "communication",
    name: "ارتباطات",
    color: "#25203a",
    stocks: [
      ["GOOGL", "Alphabet", 2240, 183.67, 1.72, 29_400_000],
      ["META", "Meta Platforms", 1610, 661.12, 2.43, 17_600_000],
      ["NFLX", "Netflix", 515, 1187.64, -2.08, 6_100_000],
      ["TMUS", "T-Mobile", 284, 238.11, 0.31, 4_500_000],
    ],
  },
  {
    id: "consumer",
    name: "مصرفی",
    color: "#2b2330",
    stocks: [
      ["AMZN", "Amazon", 2380, 224.83, -1.62, 42_700_000],
      ["TSLA", "Tesla", 1510, 436.27, 4.91, 118_300_000],
      ["WMT", "Walmart", 840, 103.42, 0.56, 15_900_000],
      ["COST", "Costco", 435, 978.55, -0.38, 2_600_000],
      ["HD", "Home Depot", 392, 384.16, 1.07, 3_800_000],
      ["MCD", "McDonald's", 218, 316.29, -0.24, 2_900_000],
    ],
  },
  {
    id: "financials",
    name: "مالی",
    color: "#1d2d32",
    stocks: [
      ["BRK.B", "Berkshire Hathaway", 1120, 520.41, 0.44, 4_200_000],
      ["JPM", "JPMorgan Chase", 780, 281.33, -0.91, 9_700_000],
      ["V", "Visa", 655, 341.82, 1.11, 5_900_000],
      ["MA", "Mastercard", 560, 548.12, 0.78, 3_100_000],
      ["BAC", "Bank of America", 385, 51.04, -1.43, 41_200_000],
    ],
  },
  {
    id: "healthcare",
    name: "سلامت",
    color: "#18312d",
    stocks: [
      ["LLY", "Eli Lilly", 910, 958.47, 2.76, 4_600_000],
      ["JNJ", "Johnson & Johnson", 405, 168.31, -0.42, 7_100_000],
      ["ABBV", "AbbVie", 372, 210.18, 0.92, 5_300_000],
      ["UNH", "UnitedHealth", 342, 378.66, -3.28, 8_800_000],
      ["MRK", "Merck", 236, 93.14, 0.18, 11_500_000],
    ],
  },
  {
    id: "energy-industrial",
    name: "انرژی و صنعت",
    color: "#33291c",
    stocks: [
      ["XOM", "Exxon Mobil", 505, 116.27, -1.82, 17_300_000],
      ["CVX", "Chevron", 288, 161.74, 0.63, 7_900_000],
      ["GE", "GE Aerospace", 300, 279.42, 2.04, 6_400_000],
      ["CAT", "Caterpillar", 230, 471.26, -0.67, 2_300_000],
    ],
  },
];

const clamp = (value, minimum, maximum) =>
  Math.min(maximum, Math.max(minimum, value));

const channel = (value) => Math.round(clamp(value, 0, 255));

const hex = (red, green, blue) =>
  `#${[red, green, blue]
    .map((value) => channel(value).toString(16).padStart(2, "0"))
    .join("")}`;

export function heatColor(change) {
  const intensity = Math.min(Math.abs(change) / 5, 1);
  if (Math.abs(change) < 0.08) return "#344052";
  if (change > 0) {
    return hex(24 - intensity * 10, 91 + intensity * 89, 69 + intensity * 31);
  }
  return hex(121 + intensity * 85, 45 - intensity * 17, 52 - intensity * 15);
}

export function formatChange(change) {
  return `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
}

export function formatMarketCap(value) {
  return value >= 1000 ? `$${(value / 1000).toFixed(2)}T` : `$${value.toFixed(0)}B`;
}

export function buildMarketTree(market = BASE_MARKET) {
  const sectors = market.map((sector) => {
    const children = sector.stocks.map(
      ([ticker, company, marketCap, price, change, volume]) => ({
        id: `stock-${ticker.replace(".", "-").toLowerCase()}`,
        name: `${ticker}  ${formatChange(change)}`,
        data: {
          $area: marketCap,
          $color: heatColor(change),
          ticker,
          company,
          sector: sector.name,
          marketCap,
          price,
          change,
          volume,
        },
      }),
    );
    const area = children.reduce((sum, child) => sum + child.data.marketCap, 0);
    return {
      id: `sector-${sector.id}`,
      name: sector.name,
      data: { $area: area, $color: sector.color, sector: sector.name },
      children,
    };
  });
  return {
    id: "market",
    name: "بازار",
    data: {
      $area: sectors.reduce((sum, sector) => sum + sector.data.$area, 0),
      $color: "#111827",
    },
    children: sectors,
  };
}

export function marketSummary(market = BASE_MARKET) {
  const stocks = market.flatMap((sector) => sector.stocks);
  const totalCap = stocks.reduce((sum, stock) => sum + stock[2], 0);
  const weightedChange = stocks.reduce(
    (sum, stock) => sum + stock[2] * stock[4],
    0,
  ) / totalCap;
  return {
    totalCap,
    weightedChange,
    advances: stocks.filter((stock) => stock[4] > 0.08).length,
    declines: stocks.filter((stock) => stock[4] < -0.08).length,
    unchanged: stocks.filter((stock) => Math.abs(stock[4]) <= 0.08).length,
  };
}

export function simulateMarket(market = BASE_MARKET, volatility = 1, random = Math.random) {
  return market.map((sector) => ({
    ...sector,
    stocks: sector.stocks.map((stock) => {
      const impulse = (random() + random() + random() - 1.5) * volatility;
      const nextChange = clamp(stock[4] * 0.72 + impulse, -7.5, 7.5);
      const nextPrice = Math.max(1, stock[3] * (1 + impulse / 100));
      const capDrift = 0.992 + random() * 0.016;
      const volumeDrift = 0.8 + random() * 0.4;
      return [
        stock[0], stock[1], stock[2] * capDrift,
        nextPrice, nextChange, Math.round(stock[5] * volumeDrift),
      ];
    }),
  }));
}
