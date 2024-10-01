// Helper functions from external sources

/*!
 * Sanitize and encode all HTML in a user-submitted string
 * (c) 2018 Chris Ferdinandi, MIT License, https://gomakethings.com
 * @param  {String} str  The user-submitted string
 * @return {String} str  The sanitized string
 */
export function sanitizeHTML(str: string) {
    var temp = document.createElement("div");
    temp.textContent = str;
    return temp.innerHTML;
}

// https://stackoverflow.com/a/37041756
// CC BY-SA 4.0
export function intersect(a: any[], b: any[]): any[] {
    var setB = new Set(b);
    return [...new Set(a)].filter(x => setB.has(x));
}