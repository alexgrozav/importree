import {
  alpha,
  beta as b,
  gamma,
} from "./named-multiline";

import type {
  Config,
  Options as Opts,
} from "./types-multiline";

import DefaultExport, {
  helper,
  util as u,
} from "./combined-multiline";

import * as ns from "./namespace-dep";

export {
  one,
  two,
} from "./reexport-multiline";

export const main = alpha + b + gamma + helper + u + ns.value + DefaultExport;
export type MainConfig = Config & Opts;
