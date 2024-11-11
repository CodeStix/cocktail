export type Drink = {
    id: number;
    name: string;
    description?: string;
    themeColor: string;
    imageUrl?: string;
};

export type ClientMessage =
    | {
          type: "drinks";
          drinks: Drink[];
      }
    | {
          type: "all-gpio";
          relay?: number;
          relay24v?: number;
      };

export type ServerMessage =
    | {
          type: "get-drinks";
      }
    | { type: "get-all-gpio" }
    | { type: "set-all-gpio"; relay?: number; relay24v?: number };
