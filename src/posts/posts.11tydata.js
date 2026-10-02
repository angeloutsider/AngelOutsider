// Future-dated posts stay hidden (no page, no collection) until their date.
const isScheduled = (data) =>
  data.date instanceof Date && data.date.getTime() > Date.now();

module.exports = {
  eleventyComputed: {
    eleventyExcludeFromCollections: (data) =>
      isScheduled(data) ? true : data.eleventyExcludeFromCollections,
    permalink: (data) => (isScheduled(data) ? false : data.permalink),
  },
};
