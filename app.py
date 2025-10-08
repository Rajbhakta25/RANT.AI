import os
from flask import Flask, render_template, request, jsonify, session
import google.generativeai as genai
import json

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
SECRET_KEY = os.urandom(24)

personas = {
    "empathetic": "You are AI Buddy, an empathetic companion. Your goal is to listen, validate feelings, and briefly summarize what you heard. Be concise and never give advice. Be optimistic.",
    "stoic": "You are a Stoic Sage. Listen to the user's troubles, acknowledge them simply, then offer one short piece of timeless wisdom about control or perception. Your tone is serene.",
    "motivator": "You are a high-energy motivational coach. Listen to the user's struggle, reframe it as a sign of their strength, and end with a short, powerful affirmation.",
    "curious": "You are a Curious Mind. Listen to the user, validate their feeling by echoing it back, then ask one single, gentle, open-ended question that helps them reflect on their feelings."
}

MIND_MAP_PROMPT = """
Your task is to analyze the following conversation and structure it into a thematic mind map. Identify key entities, emotions, and concepts as nodes. For each node, also generate a short, insightful, and gentle follow-up question that will be used as a tooltip; place this question in a 'hoverQuestion' property.
- Create smart edges. Draw connections (edges) between nodes. Edge labels must be concise, action-oriented, and grammatically correct especially in conjunction with the nodes.

Respond ONLY with a valid JSON object following this exact structure. Do not include markdown, comments, or any other text.
{
  "nodes": [
    {"id": 1, "label": "Feeling Sad", "hoverQuestion": "What does this sadness feel like in your body?"},
    {"id": 2, "label": "Loneliness", "hoverQuestion": "What does loneliness mean to you?"},
    {"id": 3, "label": "Anxiety", "hoverQuestion": "Where do you feel this anxiety in your body?"}
  ],
  "edges": [
    {"from": 1, "to": 2, "label": "linked to"},
    {"from": 1, "to": 3, "label": "results in"}
  ]
}
"""

app = Flask(__name__)
app.secret_key = SECRET_KEY

@app.route("/")
def index():
    session['chat_history'] = []
    return render_template("index.html")

@app.route("/process_rant", methods=["POST"])
def process_rant():
    try:
        user_prompt = request.json["prompt"]
        selected_persona = request.json.get("persona", "empathetic")
        system_instruction = personas.get(selected_persona, personas["empathetic"])

        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=system_instruction
        )

        if not user_prompt:
            return jsonify({"error": "Prompt is empty."}), 400

        chat_history = session.get('chat_history', [])
        model_history = []
        for message in chat_history:
            role = 'user' if message['role'] == 'user' else 'model'
            model_history.append({'role': role, 'parts': [{'text': message['text']}]})

        chat_session = model.start_chat(history=model_history)
        response = chat_session.send_message(user_prompt)
        
        chat_history.append({'role': 'user', 'text': user_prompt})
        chat_history.append({'role': 'model', 'text': response.text})
        session['chat_history'] = chat_history
        
        return jsonify({"response": response.text})

    except Exception as e:
        if "429" in str(e) and "RESOURCE_EXHAUSTED" in str(e) or "quota" in str(e).lower():
            return jsonify({"response": "AI Buddy is very popular right now! Please try again in a moment."})
        return jsonify({"error": str(e)}), 500

@app.route("/generate_mind_map", methods=["POST"])
def generate_mind_map():
    try:
        chat_history = session.get('chat_history', [])
        if not chat_history:
            return jsonify({"error": "No conversation history available."}), 400

        full_conversation = "\n".join([f"{msg['role']}: {msg['text']}" for msg in chat_history])
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content([MIND_MAP_PROMPT, full_conversation])     
        json_response_text = response.text.strip().replace("```json", "").replace("```", "")
        mind_map_data = json.loads(json_response_text)
        
        return jsonify(mind_map_data)
    except Exception as e:
        print(f"Error generating mind map: {e}")
        if "429" in str(e) and ("RESOURCE_EXHAUSTED" in str(e) or "quota" in str(e).lower()):
            return jsonify({"error": "The AI is processing a lot right now! Please try again in a moment."}), 500
        return jsonify({"error": "The AI failed to generate a valid map structure. Please try again."}), 500

if __name__ == "__main__":
    app.run()
