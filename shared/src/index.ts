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
          values: boolean[];
      };

export type ServerMessage =
    | {
          type: "get-drinks";
      }
    | { type: "get-all-gpio" }
    | { type: "set-gpio"; index: number; value: boolean };
