const { buildDouzoneTransactionPdfBuffer } = require("./transactionPdfDouzone");

function buildTransactionPdfBuffer(order) {
    var templateId = (order.issuer && order.issuer.templateId) || "douzone";
    if (templateId === "douzone") {
        return buildDouzoneTransactionPdfBuffer(order);
    }
    return buildDouzoneTransactionPdfBuffer(order);
}

module.exports = { buildTransactionPdfBuffer };
