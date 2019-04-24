import { template } from "lodash";

export default template(`
<%= typeDefs %>

/**
* <%= method.summary %>
*/
<%= functionSignature %> {
  return 123;
}
`);
