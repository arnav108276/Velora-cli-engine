## 🚨 Anomaly Detection Dashboard

## Project Overview
The Anomaly Detection Dashboard is an interactive web application built with Streamlit, enabling real-time detection and visualization of anomalies in time-series data.
It leverages Isolation Forest, PCA Reconstruction Error, and One-Class SVM to identify abnormal patterns efficiently and display results with dynamic visualizations.

## Features
Multi-Model Anomaly Detection: Combines Isolation Forest, PCA, and SVM
Real-Time Visualization with Plotly
Weighted Ensemble Scoring for better accuracy
Interactive Threshold Control for anomaly detection
Automated Output Generation with abnormality scores and top features
Dockerized Setup for seamless deployment

## System Architecture (Process Flow)
<img width="1017" height="683" alt="Screenshot 2025-08-23 at 11 12 47 PM" src="https://github.com/user-attachments/assets/e295681d-9c23-4999-bd85-56f6759881f9" />

## Tech Stack
Python 3.11
Streamlit for dashboard
scikit-learn for ML models
Pandas, NumPy for data handling
Plotly for interactive visualization
Docker for containerization

## Installation & Usage

### Step1: Clone Repository
```bash
git clone https://github.com/Aaryanb45/anomaly-detection-dashboard.git
cd anomaly-detection-dashboard

```

### Step 2:Build the Docker Container
<pre> <code>docker build -t anomaly-dashboard .</code> </pre>

### Step3: Run the Container on a Port
<pre> <code> docker run -p 8504:8504 anomaly-dashboard </code> </pre>

### Step4: Access the Application
Open the URL in your browser:
<pre> <code> http://0.0.0.0:8504</code> </pre>

### Project Structure


<pre> <code>
anomaly-detection-dashboard/
│-- anomaly_pipeline.py        # Main pipeline for anomaly detection
│-- app/
│   └── dashboard.py           # Streamlit app for visualization
│-- Dockerfile                 # Docker configuration
│-- requirements.txt           # Python dependencies
│-- timeseriesdata.csv         # Input dataset
│-- output.csv                 # Generated output with anomalies
</code></pre>


##Visualizations

## Anomaly Scores Over Time
Shows abnormality scores vs. time with anomaly highlights.

## Model-wise Scores
Raw anomaly scores from each model (IF, PCA, SVM).
## Top Features Copies
Top 7 features with highest variance for anomaly detection.

## Detected Anomalies
Tabular view of all detected anomalies above threshold.
