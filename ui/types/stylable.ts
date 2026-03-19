export type Stylable<T extends string = never> = {
  [key in `${T}TwStyles`]?: string;
} & {
  twStyles?: string;
};
