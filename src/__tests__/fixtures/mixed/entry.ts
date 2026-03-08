import { staticDep } from "./static-dep";
import type { SomeType } from "./types";
import "./side-effect";

const dynamic = import("./dynamic-dep");
const cjs = require("./cjs-dep");

export { everything } from "./reexport";

export const main = staticDep;
