import OpenAI from 'openai';

let openai;
let activeApiKey;

function getOpenAiClient(apiKey) {
  if (!openai || activeApiKey !== apiKey) {
    openai = new OpenAI({
      apiKey,
    });
    activeApiKey = apiKey;
  }

  return openai;
}

function getOpenAiErrorMessage(err) {
  const status = err.status || err.statusCode;
  const message = err.error?.message || err.message;

  if (status === 401) {
    return 'OpenAI authentication failed. Check that OPENAI_API_KEY is correct and restart the server.';
  }

  if (status === 403) {
    return 'OpenAI rejected the request. Check project permissions or model access for your API key.';
  }

  if (status === 404) {
    return 'OpenAI model was not found or is not available for this API key. Check OPENAI_MODEL in your .env file.';
  }

  if (status === 429) {
    return 'OpenAI rate limit or quota was reached. Check billing, usage limits, or retry later.';
  }

  if (status >= 500) {
    return 'OpenAI service is temporarily unavailable. Retry shortly.';
  }

  return message || 'Failed to generate QA artifact from OpenAI.';
}

function buildUserContent(prompt, imageAttachments = []) {
  const validImageAttachments = imageAttachments.filter((attachment) => {
    return attachment && typeof attachment.dataUrl === 'string' && attachment.dataUrl.startsWith('data:image/');
  });

  if (!validImageAttachments.length) {
    return prompt;
  }

  return [
    {
      type: 'text',
      text: prompt,
    },
    ...validImageAttachments.map((attachment) => ({
      type: 'image_url',
      image_url: {
        url: attachment.dataUrl,
      },
    })),
  ];
}

export async function generateQaArtifact(prompt, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const maxOutputTokens = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 5000);
  const userContent = buildUserContent(prompt, options.imageAttachments);

  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY is not configured. Add it to your .env file.');
    error.statusCode = 500;
    throw error;
  }

  try {
    const response = await getOpenAiClient(apiKey).chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: maxOutputTokens,
      messages: [
        {
          role: 'system',
          content: 'You are a senior QA engineer. Return concise, structured, practical testing output only.',
        },
        {
          role: 'user',
          content: userContent,
        },
      ],
    });

    return response.choices?.[0]?.message?.content?.trim() || '';
  } catch (err) {
    const error = new Error(getOpenAiErrorMessage(err));
    error.statusCode = err.status || err.statusCode || 502;
    error.details = err.error?.message || err.message;
    throw error;
  }
}
