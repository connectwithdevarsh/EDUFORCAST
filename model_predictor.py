import os
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
import joblib

# Set random seed for reproducibility
np.random.seed(42)

DATA_PATH = "StudentsPerformance.csv"
MODEL_PATH = "students_model.joblib"

def load_and_enhance_data():
    """
    Loads the StudentsPerformance.csv dataset and enhances it with synthetic features:
    - Attendance_Rate (55% to 100%): correlated with grades.
    - Study_Hours (2 to 30 hours/week): correlated with grades.
    - Learning_Behavior ('High Engagement', 'Moderate Engagement', 'Low Engagement'): correlated with grades.
    """
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Dataset not found at {DATA_PATH}")
        
    df = pd.read_csv(DATA_PATH)
    
    # Calculate actual average score to guide synthetic feature correlation
    avg_score = df[['math score', 'reading score', 'writing score']].mean(axis=1)
    
    # 1. Attendance Rate (%) - correlated with average score, plus some noise
    # Map avg_score (0-100) to attendance (60-100)
    attendance = 55 + (avg_score * 0.4) + np.random.normal(0, 4, size=len(df))
    df['Attendance_Rate'] = np.clip(attendance, 55.0, 100.0).round(1)
    
    # 2. Study Hours per Week - correlated with average score, plus noise
    # Map avg_score (0-100) to study hours (2-30)
    study_hours = 2 + (avg_score * 0.24) + np.random.normal(0, 3, size=len(df))
    df['Study_Hours'] = np.clip(study_hours, 2, 30).astype(int)
    
    # 3. Learning Behavior - Categorical feature based on average score and study hours
    # High, Moderate, Low Engagement
    behavior_probs = []
    for idx, row in df.iterrows():
        score = avg_score.iloc[idx]
        hours = df['Study_Hours'].iloc[idx]
        
        # Calculate a composite engagement score
        eng_score = (score / 100.0) * 0.6 + (hours / 30.0) * 0.4
        
        if eng_score > 0.7:
            behavior = 'High Engagement'
        elif eng_score > 0.4:
            behavior = 'Moderate Engagement'
        else:
            behavior = 'Low Engagement'
        behavior_probs.append(behavior)
        
    df['Learning_Behavior'] = behavior_probs
    
    # 4. Risk Level (Target for classification)
    # High Risk: Average Score < 50 OR Attendance < 75%
    # Medium Risk: Average Score between 50 and 65, and Attendance >= 75%
    # Low Risk: Average Score > 65 and Attendance >= 75%
    risk_levels = []
    for idx, row in df.iterrows():
        score = avg_score.iloc[idx]
        att = df['Attendance_Rate'].iloc[idx]
        
        if score < 52 or att < 75.0:
            risk = 'High Risk'
        elif score < 65:
            risk = 'Medium Risk'
        else:
            risk = 'Low Risk'
        risk_levels.append(risk)
        
    df['Risk_Level'] = risk_levels
    
    return df

class AcademicPredictor:
    def __init__(self):
        self.models = {}
        self.preprocessor = None
        self.feature_cols = [
            'gender', 'race/ethnicity', 'parental level of education', 
            'lunch', 'test preparation course', 'Attendance_Rate', 
            'Study_Hours', 'Learning_Behavior'
        ]
        
    def train(self):
        """
        Trains the Machine Learning models:
        - Regressors for math, reading, and writing scores.
        - Classifier for Risk Level.
        """
        df = load_and_enhance_data()
        
        X = df[self.feature_cols]
        y_math = df['math score']
        y_reading = df['reading score']
        y_writing = df['writing score']
        y_risk = df['Risk_Level']
        
        # Define preprocessing for numerical and categorical features
        numeric_features = ['Attendance_Rate', 'Study_Hours']
        categorical_features = ['gender', 'race/ethnicity', 'parental level of education', 'lunch', 'test preparation course', 'Learning_Behavior']
        
        self.preprocessor = ColumnTransformer(
            transformers=[
                ('num', StandardScaler(), numeric_features),
                ('cat', OneHotEncoder(handle_unknown='ignore'), categorical_features)
            ])
            
        # Fit preprocessor on X
        self.preprocessor.fit(X)
        
        # Train Regressors
        X_trans = self.preprocessor.transform(X)
        
        self.models['math'] = RandomForestRegressor(n_estimators=100, random_state=42)
        self.models['math'].fit(X_trans, y_math)
        
        self.models['reading'] = RandomForestRegressor(n_estimators=100, random_state=42)
        self.models['reading'].fit(X_trans, y_reading)
        
        self.models['writing'] = RandomForestRegressor(n_estimators=100, random_state=42)
        self.models['writing'].fit(X_trans, y_writing)
        
        # Train Classifier for Risk
        self.models['risk'] = RandomForestClassifier(n_estimators=100, random_state=42, class_weight='balanced')
        self.models['risk'].fit(X_trans, y_risk)
        
        # Save model
        joblib.dump({
            'models': self.models,
            'preprocessor': self.preprocessor,
            'feature_cols': self.feature_cols
        }, MODEL_PATH)
        
        print("Models trained and saved successfully.")
        
    def load(self):
        """Loads the saved models and preprocessor."""
        if not os.path.exists(MODEL_PATH):
            self.train()
        else:
            data = joblib.load(MODEL_PATH)
            self.models = data['models']
            self.preprocessor = data['preprocessor']
            self.feature_cols = data['feature_cols']
            print("Models loaded successfully.")
            
    def predict(self, student_data):
        """
        Predicts math, reading, writing scores and risk level for a single student.
        student_data: dict containing keys matching feature_cols
        """
        df_input = pd.DataFrame([student_data])
        
        # Ensure correct column order
        df_input = df_input[self.feature_cols]
        
        # Transform features
        X_trans = self.preprocessor.transform(df_input)
        
        # Predict scores
        pred_math = int(round(self.models['math'].predict(X_trans)[0]))
        pred_reading = int(round(self.models['reading'].predict(X_trans)[0]))
        pred_writing = int(round(self.models['writing'].predict(X_trans)[0]))
        
        # Clip scores to [0, 100]
        pred_math = max(0, min(100, pred_math))
        pred_reading = max(0, min(100, pred_reading))
        pred_writing = max(0, min(100, pred_writing))
        
        # Predict risk
        pred_risk = self.models['risk'].predict(X_trans)[0]
        
        # Calculate probabilities for risk
        risk_classes = self.models['risk'].classes_
        risk_probs = self.models['risk'].predict_proba(X_trans)[0]
        prob_dict = {cls: round(float(prob) * 100, 1) for cls, prob in zip(risk_classes, risk_probs)}
        
        return {
            'predicted_math': pred_math,
            'predicted_reading': pred_reading,
            'predicted_writing': pred_writing,
            'predicted_average': round((pred_math + pred_reading + pred_writing) / 3, 1),
            'predicted_risk': pred_risk,
            'risk_probabilities': prob_dict
        }

def get_analytics():
    """Returns aggregated data for charts and dashboard metrics."""
    df = load_and_enhance_data()
    
    # 1. Overview metrics
    total_students = len(df)
    avg_math = round(df['math score'].mean(), 1)
    avg_reading = round(df['reading score'].mean(), 1)
    avg_writing = round(df['writing score'].mean(), 1)
    
    risk_counts = df['Risk_Level'].value_counts().to_dict()
    high_risk_count = risk_counts.get('High Risk', 0)
    high_risk_pct = round((high_risk_count / total_students) * 100, 1)
    
    # 2. Score distribution by gender
    gender_avg = df.groupby('gender', observed=False)[['math score', 'reading score', 'writing score']].mean().round(1).to_dict(orient='index')
    
    # 3. Score by parental education
    parental_avg = df.groupby('parental level of education', observed=False)[['math score', 'reading score', 'writing score']].mean().round(1)
    # Sort by average of three scores
    parental_avg['overall'] = parental_avg.mean(axis=1)
    parental_avg = parental_avg.sort_values(by='overall').drop(columns=['overall']).to_dict(orient='index')
    
    # 4. Impact of Test Preparation Course
    test_prep_avg = df.groupby('test preparation course', observed=False)[['math score', 'reading score', 'writing score']].mean().round(1).to_dict(orient='index')
    
    # 5. Attendance vs Average Score (Binned for chart)
    df['attendance_bin'] = pd.cut(df['Attendance_Rate'], bins=[50, 70, 80, 90, 100], labels=['55-70%', '70-80%', '80-90%', '90-100%'])
    att_avg = df.groupby('attendance_bin', observed=False)[['math score', 'reading score', 'writing score']].mean().round(1)
    att_avg['overall'] = att_avg.mean(axis=1).round(1)
    att_avg_dict = att_avg['overall'].to_dict()
    
    # 6. Study Hours vs Average Score (Binned for chart)
    df['study_bin'] = pd.cut(df['Study_Hours'], bins=[0, 5, 10, 15, 20, 30], labels=['0-5 hrs', '5-10 hrs', '10-15 hrs', '15-20 hrs', '20+ hrs'])
    study_avg = df.groupby('study_bin', observed=False)[['math score', 'reading score', 'writing score']].mean().round(1)
    study_avg['overall'] = study_avg.mean(axis=1).round(1)
    study_avg_dict = study_avg['overall'].to_dict()

    # 7. Engagement level vs Risk distribution
    behavior_risk = df.groupby(['Learning_Behavior', 'Risk_Level'], observed=False).size().unstack(fill_value=0).to_dict(orient='index')
    
    return {
        'metrics': {
            'total_students': total_students,
            'avg_math': avg_math,
            'avg_reading': avg_reading,
            'avg_writing': avg_writing,
            'high_risk_count': high_risk_count,
            'high_risk_pct': high_risk_pct
        },
        'gender_analytics': gender_avg,
        'parental_analytics': parental_avg,
        'test_prep_analytics': test_prep_avg,
        'attendance_analytics': att_avg_dict,
        'study_analytics': study_avg_dict,
        'behavior_risk_analytics': behavior_risk
    }

if __name__ == '__main__':
    # Test the model training and prediction
    predictor = AcademicPredictor()
    predictor.train()
    predictor.load()
    test_student = {
        'gender': 'female',
        'race/ethnicity': 'group B',
        'parental level of education': "bachelor's degree",
        'lunch': 'standard',
        'test preparation course': 'none',
        'Attendance_Rate': 85.5,
        'Study_Hours': 12,
        'Learning_Behavior': 'Moderate Engagement'
    }
    print("Test Prediction:", predictor.predict(test_student))
    print("Analytics metrics:", get_analytics()['metrics'])
