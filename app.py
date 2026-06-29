from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import os
import pandas as pd
from model_predictor import AcademicPredictor, get_analytics, load_and_enhance_data

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)

# Initialize and load predictor
predictor = AcademicPredictor()
try:
    predictor.load()
except Exception as e:
    print(f"Error loading model, retraining: {e}")
    predictor.train()

@app.route('/')
def home():
    """Renders the main dashboard page."""
    return render_template('index.html')

@app.route('/api/analytics', methods=['GET'])
def api_analytics():
    """Returns analytics data for the dashboard charts and overview metrics."""
    try:
        data = get_analytics()
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/predict', methods=['POST'])
def api_predict():
    """
    Predicts student scores and academic risk.
    Expects JSON body with:
      gender, race/ethnicity, parental level of education, lunch, 
      test preparation course, Attendance_Rate, Study_Hours, Learning_Behavior
    """
    try:
        data = request.get_json()
        
        # Validation
        required_fields = [
            'gender', 'race/ethnicity', 'parental level of education', 
            'lunch', 'test preparation course', 'Attendance_Rate', 
            'Study_Hours', 'Learning_Behavior'
        ]
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
                
        # Data types conversion
        student_data = {
            'gender': str(data['gender']),
            'race/ethnicity': str(data['race/ethnicity']),
            'parental level of education': str(data['parental level of education']),
            'lunch': str(data['lunch']),
            'test preparation course': str(data['test preparation course']),
            'Attendance_Rate': float(data['Attendance_Rate']),
            'Study_Hours': int(data['Study_Hours']),
            'Learning_Behavior': str(data['Learning_Behavior'])
        }
        
        prediction = predictor.predict(student_data)
        return jsonify(prediction)
        
    except ValueError as ve:
        return jsonify({'error': f'Invalid value type: {str(ve)}'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/students', methods=['GET'])
def api_students():
    """Returns the list of all students with their actual and predicted risk."""
    try:
        df = load_and_enhance_data()
        # Add index as Student ID
        df['student_id'] = [f"STU{1000 + i}" for i in range(len(df))]
        
        # Calculate Average Score
        df['Average_Score'] = df[['math score', 'reading score', 'writing score']].mean(axis=1).round(1)
        
        # Convert to list of dicts
        students_list = df.to_dict(orient='records')
        return jsonify(students_list)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/retrain', methods=['POST'])
def api_retrain():
    """Force-retrains the model."""
    try:
        predictor.train()
        predictor.load()
        return jsonify({'message': 'Model retrained successfully.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Run Flask App
    app.run(debug=True, port=5000)
