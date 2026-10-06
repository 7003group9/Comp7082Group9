// Items like IDs, cards and phones never go in the public list.
// They are routed to Campus Security instead.
const SENSITIVE = /\b(student card|id card|\bid\b|passport|licen[sc]e|credit card|debit card|bank card|phone|iphone|android)\b/i;

export const isSensitive = (text = '') => SENSITIVE.test(text);
