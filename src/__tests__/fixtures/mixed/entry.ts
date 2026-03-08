import { staticDep } from "./static-dep";
// eslint-disable-next-line no-unused-vars
import type { SomeType } from "./types";
import "./side-effect";

// eslint-disable-next-line no-unused-vars
const dynamic = import("./dynamic-dep");
// eslint-disable-next-line no-unused-vars
const cjs = require("./cjs-dep");

export { everything } from "./reexport";

export const main = staticDep;
