const express = require("express");
const crypto = require("crypto");
const forms = express.Router();
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const fs = require("fs");
const path = require("path");
const mailersend = require("../helpers/mailersend");
const { getDaySuffix } = require("../helpers/utils");

const FIELD_IDS = {
  firstName: "cFxeVWq37AKA",
  lastName: "zXmNeNUIT8xY",
  hasPREC: "X4KHW9HdByjt",
  PREC: "GF6OG8Oqfl3C",
  email: "28G7Sj9Vmy39",
  phone: "bHhOhyJLiwUy",
  address: "WrawlU96taGL",
  city: "dcaRmYhXRwLM",
  province: "QxchUCyXIeZU",
  postalCode: "mctgK2PL2GBC",
  status: "H6UJNaVtJjzx",
};

const verifySignature = (signature, payload) => {
  const hash = crypto
    .createHmac("sha256", process.env.TYPEFORM_SECRET)
    .update(payload)
    .digest("base64");

  return signature === `sha256=${hash}`;
};

const findAnswerById = (answers, id) => {
  return answers.find((answer) => answer.field.id === id);
};

const getEmailBody = (form_response) => {
  const fields = form_response.definition.fields;
  const answers = form_response.answers;

  let bodyHTML = "";

  for (const answer of answers) {
    const field = fields.find((field) => field.id === answer.field.id);
    const title = field.title.replace(/\{\{.*\}\}\, /, "");
    const value = answer[answer.type];

    bodyHTML += `<div>${title}: ${
      typeof value === "object" ? JSON.stringify(value) : value
    }</div>`;
  }

  return bodyHTML;
};

forms.post(
  "/onboarding",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    // -------------------- Verify signature --------------------
    const isSignatureValid = verifySignature(
      req.headers["typeform-signature"],
      req.body.toString()
    );

    if (!isSignatureValid) {
      return res.status(400).send("Invalid signature");
    }

    // -------------------- Generate document --------------------

    const { form_response } = JSON.parse(req.body);
    const { answers } = form_response;

    // Load the docx file as binary content
    const content = fs.readFileSync(
      path.resolve(
        __dirname.replace("routes", "docs/input"),
        "IC RARE Contract 2022.docx"
      ),
      "binary"
    );

    const zip = new PizZip(content);

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    const firstName = findAnswerById(answers, FIELD_IDS.firstName).text;
    const lastName = findAnswerById(answers, FIELD_IDS.lastName).text;
    const hasPREC = findAnswerById(answers, FIELD_IDS.hasPREC).boolean;
    const PREC = findAnswerById(answers, FIELD_IDS.PREC)?.text;
    const email = findAnswerById(answers, FIELD_IDS.email).email;
    const phone = findAnswerById(answers, FIELD_IDS.phone).phone_number;
    const address = findAnswerById(answers, FIELD_IDS.address).text;
    const city = findAnswerById(answers, FIELD_IDS.city).text;
    const province = findAnswerById(answers, FIELD_IDS.province).text;
    const postalCode = findAnswerById(answers, FIELD_IDS.postalCode).text;

    const today = new Date();
    const dayString = `${today.getDate()}${getDaySuffix(
      today.getDate()
    )} day of ${today.toLocaleString("default", {
      month: "long",
    })} ${today.getFullYear()}`;

    const precSign = hasPREC
      ? "Name of Agent PREC:\nPer: _____________________________\nName:\nTitle:"
      : "Agent Name:";

    const status = findAnswerById(answers, FIELD_IDS.status)?.choice?.label;

    const salespersonCheck = status === "Sales Representative" ? "X" : "";
    const brokerCheck = status === "Broker" ? "X" : "";

    // Replace {} fields
    doc.render({
      firstName,
      lastName,
      prec: hasPREC ? PREC : "",
      email,
      phone,
      address,
      city,
      province,
      postalCode,
      dayString,
      precSign,
      salespersonCheck,
      brokerCheck,
    });

    const buf = doc.getZip().generate({
      type: "nodebuffer",
      // compression: DEFLATE adds a compression step.
      // For a 50MB output document, expect 500ms additional CPU time
      compression: "DEFLATE",
    });

    // buf is a nodejs Buffer, you can either write it to a
    // file or res.send it with express for example.
    fs.writeFileSync(
      path.resolve(
        __dirname.replace("routes", "docs/output"),
        `IC RARE Contract 2022 - ${firstName} ${lastName}.docx`
      ),
      buf
    );

    // -------------------- Email document --------------------

    await mailersend.sendEmail({
      email: "fatema@rarerealestate.ca",
      template: "onboarding_form",
      data: {
        body: getEmailBody(form_response),
        attachment: {
          path: path.resolve(
            __dirname.replace("routes", "docs/output"),
            `IC RARE Contract 2022 - ${firstName} ${lastName}.docx`
          ),
          name: `IC RARE Contract 2022 - ${firstName} ${lastName}.docx`,
        },
      },
    });

    return res.send("Success");
  }
);

module.exports = forms;
