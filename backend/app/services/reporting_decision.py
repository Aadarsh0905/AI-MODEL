import os
import json
from datetime import datetime, timezone
import pandas as pd
from openpyxl import Workbook
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from typing import Dict, Any, List

class DecisionSupportService:
    @staticmethod
    def evaluate_hazard_risks(
        slope_mean: float,
        vegetation_loss_pct: float,
        max_erosion_depth_m: float,
        low_elevation_zone: bool
    ) -> Dict[str, Any]:
        """
        Calculates terrain hazards using geomorphic and environmental indicators.
        Returns safety levels and advisory instructions.
        """
        alerts = []
        recommendations = []
        
        # 1. Landslide risk
        landslide_risk = "LOW"
        if slope_mean > 25.0 and vegetation_loss_pct > 15.0:
            landslide_risk = "HIGH"
            alerts.append("CRITICAL: Severe risk of slope failure and landslide in high gradient zones.")
            recommendations.append("Apply immediate bio-engineering soil stabilisation and restrict vehicle access.")
        elif slope_mean > 15.0 or vegetation_loss_pct > 5.0:
            landslide_risk = "MODERATE"
            alerts.append("WARNING: Moderate slope instability detected.")
            recommendations.append("Schedule regular drone visual surveys and monitor soil saturation.")

        # 2. Flood warning
        flood_risk = "LOW"
        if low_elevation_zone and max_erosion_depth_m < -0.3:
            flood_risk = "HIGH"
            alerts.append("CRITICAL: Extreme channel erosion indicates active fluvial flooding.")
            recommendations.append("Clear debris from channel outlets and update emergency bypass plans.")
        elif low_elevation_zone:
            flood_risk = "MODERATE"
            alerts.append("WARNING: Low lying basin zone vulnerable to flash flooding.")
            recommendations.append("Establish permanent flow gauges and monitor watershed inflows.")

        # Overall risk level
        risk_matrix = {"LOW": 1, "MODERATE": 2, "HIGH": 3}
        max_score = max(risk_matrix[landslide_risk], risk_matrix[flood_risk])
        overall_risk = [k for k, v in risk_matrix.items() if v == max_score][0]

        return {
            "overall_hazard_level": overall_risk,
            "risks": {
                "landslide": landslide_risk,
                "flooding": flood_risk
            },
            "triggered_alerts": alerts,
            "recommended_actions": recommendations
        }

class ReportingService:
    @staticmethod
    def generate_pdf_report(
        output_path: str,
        title: str,
        metadata: Dict[str, Any],
        table_data: List[List[str]]
    ) -> str:
        """
        Constructs a complete structural PDF report including data tables
        and institutional sign-off lines using ReportLab.
        """
        doc = SimpleDocTemplate(output_path, pagesize=letter)
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'ReportTitle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=18,
            textColor=colors.HexColor("#1A365D"),
            spaceAfter=12
        )
        body_style = ParagraphStyle(
            'ReportBody',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            leading=14,
            spaceAfter=8
        )

        elements = []
        
        # Title
        elements.append(Paragraph(title, title_style))
        elements.append(Spacer(1, 10))

        # Metadata Section
        elements.append(Paragraph(f"<b>Generated On:</b> {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}", body_style))
        for key, val in metadata.items():
            elements.append(Paragraph(f"<b>{key}:</b> {val}", body_style))
        
        elements.append(Spacer(1, 15))

        # Table section
        if table_data:
            t = Table(table_data)
            t.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1A365D")),
                ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                ('BOTTOMPADDING', (0,0), (-1,0), 6),
                ('BACKGROUND', (0,1), (-1,-1), colors.HexColor("#F7FAFC")),
                ('GRID', (0,0), (-1,-1), 1, colors.HexColor("#E2E8F0")),
                ('FONTSIZE', (0,0), (-1,-1), 9),
            ]))
            elements.append(t)

        elements.append(Spacer(1, 30))
        elements.append(Paragraph("<b>Institutional Sign-Off:</b>", body_style))
        elements.append(Spacer(1, 15))
        
        # Signature block table
        sig_data = [
            ["___________________________", "___________________________"],
            ["Lead Researcher Signature", "GIS Analyst Verification"]
        ]
        sig_table = Table(sig_data)
        sig_table.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('FONTNAME', (0,1), (-1,1), 'Helvetica-Oblique'),
            ('FONTSIZE', (0,0), (-1,-1), 9),
        ]))
        elements.append(sig_table)

        doc.build(elements)
        return output_path

    @staticmethod
    def generate_excel_report(
        output_path: str,
        sheet_name: str,
        data_records: List[Dict[str, Any]]
    ) -> str:
        """
        Creates a spreadsheet report with proper formatting using openpyxl and pandas.
        """
        df = pd.DataFrame(data_records)
        df.to_excel(output_path, index=False, sheet_name=sheet_name)
        return output_path
