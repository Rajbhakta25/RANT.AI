import os
from flask import Flask, render_template, request, jsonify, session
import google.generativeai as genai

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

SECRET_KEY = os.urandom(24)

personas = {
    "empathetic": "You are AI Buddy, an empathetic companion. Your goal is to listen, validate feelings, and briefly summarize what you heard. Be concise and never give advice.",
    "stoic": "You are a Stoic Sage. Listen to the user's troubles, acknowledge them simply, then offer one short piece of timeless wisdom about control or perception. Your tone is serene.",
    "motivator": "You are a high-energy motivational coach. Listen to the user's struggle, reframe it as a sign of their strength, and end with a short, powerful affirmation like 'You've got this!'",
    "curious": "You are a Curious Mind. Listen to the user, validate their feeling by echoing it back, then ask one single, gentle, open-ended question that helps them reflect on their feelings."
}

app = Flask(__name__)
app.secret_key = SECRET_KEY

@app.route("/")
def index():
    session.pop('chat_history', None)
    return render_template("index.html")

@app.route("/process_rant", methods=["POST"])
def process_rant():
    try:
        user_prompt = request.json["prompt"]
        selected_persona = request.json.get("persona", "empathetic")
        system_instruction = personas.get(selected_persona, personas["empathetic"])

        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash-latest",
            system_instruction=system_instruction
        )

        if not user_prompt:
            return jsonify({"error": "Prompt is empty."}), 400

        chat_history = session.get('chat_history', [])
        chat_session = model.start_chat(history=chat_history)
        response = chat_session.send_message(user_prompt)
        
        session['chat_history'] = [
            {'role': message.role, 'parts': [part.text for part in message.parts]} 
            for message in chat_session.history
        ]
        
        return jsonify({"response": response.text})

    except Exception as e:
        if "429" in str(e) and "RESOURCE_EXHAUSTED" in str(e) or "quota" in str(e).lower():
            return jsonify({"response": "AI Buddy is very popular right now! Please try again in a moment."})
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run()