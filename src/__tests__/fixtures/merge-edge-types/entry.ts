import { bar } from "./dep";
import "./dep";
import * as ns from "./ns-dep";
import { baz } from "./ns-dep";
import { qux } from "./reexport-dep";
export * from "./reexport-dep";
import "./side-dep";
import "./side-dep";

export const main = bar + ns.baz + baz + qux;
