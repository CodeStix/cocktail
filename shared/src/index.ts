export type Drink = {
    id: number;
    name: string;
    description?: string;
    themeColor: string;
    imageUrl?: string;
};

export type Output = {
    id: number;
    index: number;
    name: string;
    enabled?: boolean;
};

export type ClientMessage =
    | {
          type: "drinks";
          drinks: Drink[];
      }
    | {
          type: "all-outputs";
          outputs: Output[];
      };

export type ServerMessage =
    | { type: "get-drinks" }
    | { type: "get-all-outputs" }
    | { type: "update-output"; id: number; name?: string; index?: number }
    | { type: "set-output-enabled"; id: number; enabled: boolean };
