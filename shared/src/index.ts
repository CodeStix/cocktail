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
          values: {
              value: boolean;
              function: string | null;
          }[];
      }
    | {
          type: "all-gpio-functions";
          values: string[];
      };

export type ServerMessage =
    | { type: "get-drinks" }
    | { type: "get-all-gpio" }
    | { type: "set-gpio"; index: number; value: boolean }
    | { type: "get-all-gpio-functions" }
    | { type: "set-gpio-function"; index: number; function: string };
