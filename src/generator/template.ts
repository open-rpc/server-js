import { template } from "lodash";

export default template(`
/**
* <%= method.summary %>
*/
<%= functionSignature %> {
  return 123;
}
`);
