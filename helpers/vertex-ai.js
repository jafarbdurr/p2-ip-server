const {VertexAI} = require('@google-cloud/vertexai');

async function vertexAi (req, res, next) {
  const result = await generate_from_text_input(req.body.pass)
  res.json({result})
}

/**
 * TODO(developer): Update these variables before running the sample.
 */
async function generate_from_text_input(text) {
  const projectId = 'focus-cache-425006-h1'
  const vertexAI = new VertexAI({project: projectId, location: 'asia-southeast1'});
  console.log(text);

  const generativeModel = vertexAI.getGenerativeModel({
    model: 'gemini-1.5-flash-001',
  });

  const prompt =
    `my password is "${text}", just give a level how strong is my password with one sentence`

  const resp = await generativeModel.generateContent(prompt);
  const contentResponse = resp.response;
  console.log(contentResponse.candidates[0].content.parts[0].text);
  return contentResponse.candidates[0].content.parts[0].text;
}


module.exports = vertexAi