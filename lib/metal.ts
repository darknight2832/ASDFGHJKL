export type MetalCatalogEntry = {
  id: string;
  name: string;
  symbol: string;
  unit: string;
  display: string;
  defaultQuery: string;
};

export const METAL_CATALOG: MetalCatalogEntry[] = [
  {
    id: "copper",
    name: "Copper",
    symbol: "LME-XCU",
    unit: "USD/ton",
    display: "Copper (LME)",
    defaultQuery: "copper cathode price per kg"
  },
  {
    id: "aluminum",
    name: "Aluminum",
    symbol: "LME-ALU",
    unit: "USD/ton",
    display: "Aluminum (LME)",
    defaultQuery: "aluminum ingot price per kg"
  },
  {
    id: "nickel",
    name: "Nickel",
    symbol: "LME-NI",
    unit: "USD/ton",
    display: "Nickel (LME)",
    defaultQuery: "nickel cathode price per kg"
  },
  {
    id: "zinc",
    name: "Zinc",
    symbol: "LME-ZNC",
    unit: "USD/ton",
    display: "Zinc (LME)",
    defaultQuery: "zinc ingot price per kg"
  },
  {
    id: "lead",
    name: "Lead",
    symbol: "LME-PB",
    unit: "USD/ton",
    display: "Lead (LME)",
    defaultQuery: "lead ingot price per kg"
  },
  {
    id: "tin",
    name: "Tin",
    symbol: "LME-SN",
    unit: "USD/ton",
    display: "Tin (LME)",
    defaultQuery: "tin ingot price per kg"
  }
];

export const METAL_BY_ID = new Map(METAL_CATALOG.map((metal) => [metal.id, metal]));

export const DEFAULT_METAL_ID = "copper";

export const FRED_SERIES_BY_METAL: Record<string, string> = {
  copper: "PCOPPUSDM"
};
