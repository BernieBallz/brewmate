export interface BrewfatherFermentable {
  name: string;
  amount: number;
  percentage?: number;
  use: 'Mash' | 'Boil' | string;
  type: string;
  time?: number | null;
  potential?: number;
}

export interface BrewfatherMashStep {
  name: string;
  type?: string;
  stepTemp: number;
  stepTime: number;
  rampTime?: number | null;
}

export interface BrewfatherHop {
  name: string;
  amount: number;
  use: 'Boil' | 'Whirlpool' | 'Flameout' | 'First Wort' | 'Dry Hop' | string;
  time: number | null;
  ibu?: number;
  type?: string;
  alpha?: number;
  temp?: number | null;
}

export interface BrewfatherMisc {
  name: string;
  amount: number;
  unit: string;
  use: 'Mash' | 'Sparge' | 'Boil' | 'Flameout' | 'Whirlpool' | 'Primary' | 'Secondary' | string;
  time?: number | null;
  type?: string;
  notes?: string | null;
}

export interface BrewfatherYeast {
  name: string;
  laboratory?: string;
  amount?: number;
  unit?: string;
  type?: string;
  form?: string;
  minTemp?: number;
  maxTemp?: number;
}

export interface BrewfatherEquipment {
  name?: string;
  batchSize?: number;
  boilSize?: number;
  boilTime?: number;
  whirlpoolTime?: number | null;
  hopstandTemperature?: number | null;
  spargeTemperature?: number | null;
}

export interface BrewfatherRecipe {
  name: string;
  author?: string;
  type?: string;
  batchSize: number;
  boilTime: number;
  boilSize?: number;
  efficiency?: number;
  mashEfficiency?: number;
  og?: number;
  fg?: number;
  abv?: number;
  ibu?: number;
  color?: number;
  preBoilGravity?: number;
  postBoilGravity?: number;
  primaryTemp?: number;
  notes?: string;
  data?: {
    strikeWaterAmount?: number | null;
    spargeWaterAmount?: number | null;
    totalWaterAmount?: number | null;
    mashVolume?: number | null;
    strikeTemp?: number | null;
  };
  water?: {
    mashAdjustments?: any;
    spargeAdjustments?: any;
    totalAdjustments?: any;
  };
  fermentables?: BrewfatherFermentable[];
  mash?: {
    name?: string;
    steps?: BrewfatherMashStep[];
  };
  hops?: BrewfatherHop[];
  miscs?: BrewfatherMisc[];
  equipment?: BrewfatherEquipment;
  yeasts?: BrewfatherYeast[];
}
