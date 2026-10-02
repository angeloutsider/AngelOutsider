module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/static");

  eleventyConfig.addCollection("posts", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/posts/*.md").filter(post => !post.data.archived);
  });

  eleventyConfig.addFilter("removeLeadingSlash", function(url) {
    return url.startsWith("/") ? url.slice(1) : url;
  });

  // Front-matter dates are UTC midnight; local getters would show the previous day.
  eleventyConfig.addFilter("formatDate", function(dateValue) {
    if (!dateValue) return '';
    const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (isNaN(d)) return '';
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
  });

  eleventyConfig.addFilter("isoDate", function(dateValue) {
    const d = dateValue instanceof Date ? dateValue : new Date(dateValue || Date.now());
    return isNaN(d) ? '' : d.toISOString();
  });

  return {
    dir: {
      input: "src",
      output: "docs",
      includes: "_includes",
      data: "_data"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["md", "njk", "html"]
  };
};
