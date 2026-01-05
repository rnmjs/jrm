// @ts-check
import { Builder } from "fenge/eslint-config";

export default new Builder()
  .enableHtml()
  .enablePackageJson({
    omit: ["pkg-json/required-dev-engines"],
  })
  .enableJavaScript()
  .enableTypeScript()
  .toConfig();
