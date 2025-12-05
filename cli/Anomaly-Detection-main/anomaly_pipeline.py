import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest
from sklearn.decomposition import PCA
from sklearn.svm import OneClassSVM


# ✅ Step 1: Clean and validate data
def validate_and_prepare(df: pd.DataFrame) -> pd.DataFrame:
    """Keep only numeric features and impute NaNs with mean."""
    numeric_df = df.select_dtypes(include=[np.number]).copy()
    return numeric_df.fillna(numeric_df.mean())


# ✅ Step 2: Scale with training only
def scale_data(train_df: pd.DataFrame, test_df: pd.DataFrame):
    scaler = StandardScaler()
    X_train = scaler.fit_transform(train_df)
    X_test = scaler.transform(test_df)
    return X_train, X_test, scaler


# ✅ Step 3: Fit models on training
def fit_models(X_train: np.ndarray):
    return {
        "IF": IsolationForest(
            n_estimators=200, contamination=0.05, random_state=42
        ).fit(X_train),
        "PCA": PCA(n_components=0.95, random_state=42).fit(X_train),
        "SVM": OneClassSVM(kernel="rbf", nu=0.05, gamma="scale").fit(X_train),
    }


# ✅ PCA helper: reconstruction error
def pca_reconstruction_error(model: PCA, X: np.ndarray) -> np.ndarray:
    X_proj = model.inverse_transform(model.transform(X))
    return np.mean((X - X_proj) ** 2, axis=1)


# ✅ Step 4: Score test data
def score_models(models, X_test: np.ndarray) -> dict:
    return {
        "IF": -models["IF"].score_samples(X_test),
        "PCA": pca_reconstruction_error(models["PCA"], X_test),
        "SVM": -models["SVM"].score_samples(X_test),
    }


# ✅ Step 5: Weighted ensemble scoring
def ensemble_score(scores: dict, weights: dict) -> np.ndarray:
    combined = (
        weights["IF"] * scores["IF"]
        + weights["PCA"] * scores["PCA"]
        + weights["SVM"] * scores["SVM"]
    )
    return np.interp(combined, (combined.min(), combined.max()), (0, 100))


# ✅ Step 6: Get top features (variance-based)
def get_top_features(X: np.ndarray, feature_names: list, k: int = 7) -> list:
    variances = X.var(axis=0)
    top_indices = np.argsort(variances)[::-1][:k]
    return [feature_names[i] for i in top_indices]


# ✅ Step 7: Save output
def save_output(df: pd.DataFrame, output_csv: str) -> None:
    df.to_csv(output_csv, index=False)


# ✅ Final pipeline
def run_anomaly_pipeline(input_csv: str, output_csv: str, time_col: str = "Time") -> pd.DataFrame:
    print(f"\n📂 Processing dataset: {input_csv}")
    df_raw = pd.read_csv(input_csv)

    # Ensure timestamp is datetime + sorted
    df_raw[time_col] = pd.to_datetime(df_raw[time_col])
    df_raw = df_raw.sort_values(by=time_col).reset_index(drop=True)

    # Temporal split 70/30
    split_idx = int(len(df_raw) * 0.7)
    df_train, df_test = df_raw.iloc[:split_idx], df_raw.iloc[split_idx:]
    print(f"🔹 Train size: {len(df_train)} | Test size: {len(df_test)}")

    # Clean numeric features
    df_train_clean = validate_and_prepare(df_train)
    df_test_clean = validate_and_prepare(df_test)
    feature_names = df_train_clean.columns.tolist()

    # Scale
    X_train, X_test, _ = scale_data(df_train_clean, df_test_clean)

    # Fit models
    models = fit_models(X_train)

    # Get scores on test
    raw_scores = score_models(models, X_test)

    # Ensemble
    ens = ensemble_score(raw_scores, {"IF": 0.5, "PCA": 0.3, "SVM": 0.2})

    # Build output DataFrame
    output_df = df_test.copy()
    output_df["abnormality_score"] = ens
    output_df["IF_score"] = raw_scores["IF"]
    output_df["PCA_score"] = raw_scores["PCA"]
    output_df["SVM_score"] = raw_scores["SVM"]

    # Add top feature copies for visibility
    top_features = get_top_features(X_train, feature_names, k=7)
    for col in top_features:
        if col in df_test.columns:
            output_df[f"{col}_copy"] = df_test[col]

    # Save
    save_output(output_df, output_csv)
    print(f"✅ Output saved with abnormality_score + raw model scores + top features → {output_csv}\n")

    return output_df


if __name__ == "__main__":
    run_anomaly_pipeline("timeseriesdata.csv", "output.csv", time_col="Time")
