import "./dep";
import { bar } from "./dep";
import * as ns from "./ns-dep";
import { baz } from "./ns-dep";

export const main = bar + ns.baz + baz;
