import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import streamlit as st
import pandas as pd
import plotly.express as px
from anomaly_pipeline import run_anomaly_pipeline 

st.set_page_config(page_title=" Anomaly Detection Dashboard", layout="wide")
st.title(" Anomaly Detection Dashboard")
st.write("Upload a CSV with a **Time column** and numeric features to run the anomaly detection pipeline.")

# 📂 File uploader
uploaded_file = st.file_uploader("Upload CSV file", type=["csv"])

if uploaded_file:
    input_csv = "uploaded.csv"
    output_csv = "output.csv"

    # Save uploaded file locally
    with open(input_csv, "wb") as f:
        f.write(uploaded_file.getbuffer())

    # Preview for selecting time column
    df_preview = pd.read_csv(input_csv)
    time_col = st.selectbox("Select Time Column:", df_preview.columns, index=0)

    # Run pipeline
    with st.spinner("🔎 Running anomaly detection..."):
        output_df = run_anomaly_pipeline(input_csv, output_csv, time_col=time_col)
    st.success(" Analysis complete!")

    # Show output preview
    st.subheader(" Output Preview")
    st.dataframe(output_df.head(20))

    # Download option
    st.download_button(
        label=" Download Results as CSV",
        data=open(output_csv, "rb").read(),
        file_name="anomaly_output.csv",
        mime="text/csv",
    )

    # 📊 Visualization: Abnormality Score
    st.subheader(" Anomaly Scores Over Time")
    fig = px.line(
        output_df,
        x=time_col,
        y="abnormality_score",
        title="Anomaly Score Over Time",
        markers=True,
    )

    # Highlight anomalies
    threshold = st.slider("Set Abnormality Threshold", 0, 100, 80)
    anomalies = output_df[output_df["abnormality_score"] > threshold]
    if not anomalies.empty:
        fig.add_scatter(
            x=anomalies[time_col],
            y=anomalies["abnormality_score"],
            mode='markers',
            marker=dict(color='red', size=8),
            name='Anomalies'
        )
    st.plotly_chart(fig, use_container_width=True)

    # Model-wise scores
    st.subheader(" Model-wise Scores")
    score_cols = ["IF_score", "PCA_score", "SVM_score"]
    fig2 = px.line(
        output_df,
        x=time_col,
        y=score_cols,
        title="Raw Model Scores Over Time"
    )
    st.plotly_chart(fig2, use_container_width=True)

    # Show top feature copies if available
    top_cols = [c for c in output_df.columns if "_copy" in c]
    if top_cols:
        st.subheader(" Top Features Copies")
        st.dataframe(output_df[top_cols].head(20))

    # Show anomalies in table
    st.subheader(" Detected Anomalies")
    if not anomalies.empty:
        st.dataframe(anomalies[[time_col, "abnormality_score"] + score_cols].head(50))
    else:
        st.info("No anomalies detected at this threshold.")

else:
    st.info("👆 Upload a CSV file to get started.")
