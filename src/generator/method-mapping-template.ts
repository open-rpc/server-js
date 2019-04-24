import { template } from "lodash";

export default template(`
<% methods.forEach((method) => { %>
import <%= method.name %> from "./<%= method.name %>";
<% }) %>

export {
<% methods.forEach((method) => { %>
  <%= method.name %>,
<% }) %>
};
`);
