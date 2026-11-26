import app from "./app.js";
import { connect } from "./config/database.js";

await connect();
app.listen(8080, "0.0.0.0", () => console.log("Blog API listening on port 8080"));
