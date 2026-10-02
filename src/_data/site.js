// `serve` runs at the domain root; production is under the Pages project path.
const isLocalServe = process.env.ELEVENTY_RUN_MODE === "serve";

module.exports = {
  name: "ANGEL OUTSIDER",
  baseUrl: isLocalServe ? "/" : "/AngelOutsider/",
  url: "https://angeloutsider.github.io/AngelOutsider",
  description: "Angel Outsider is a blog and digital archive by Amelie Wu and Raine Torres — an ode to Los Angeles and everything it has given two girls from the Valley.",
  author: "Amelie Wu and Raine Torres"
};
