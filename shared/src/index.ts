export type Drink = {
    id: number;
    name: string;
    description?: string;
    themeColor: string;
    imageUrl?: string;
};

export type ClientMessage = {
    type: "drinks";
    drinks: Drink[];
};

export type ServerMessage = {
    type: "get-drinks";
};
