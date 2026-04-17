module.exports = function(eleventyConfig) {
  // Copy static assets to maintain your existing structure
  eleventyConfig.addPassthroughCopy("src/static");
  // Create a collection for blog posts
  eleventyConfig.addCollection("posts", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/posts/*.md");
  });

  eleventyConfig.addFilter("removeLeadingSlash", function(url) {
    return url.startsWith("/") ? url.slice(1) : url;
  });

  eleventyConfig.addFilter("formatDate", function(dateValue) {
    if (!dateValue) return '';
    if (typeof dateValue === 'string') {
      const parts = dateValue.split('-');
      if (parts.length === 3) {
        return `${parseInt(parts[1])}/${parseInt(parts[2])}/${parts[0]}`;
      }
    }
    const d = new Date(dateValue);
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  });
  
  // Set input/output directories
  return {
    dir: {
      input: "src",
      output: "docs",
      includes: "_includes",
      data: "_data"
    },
    // Use Nunjucks for templating
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["md", "njk", "html"]
  };
};