"""
PowerPoint (.pptx) Presentation Generator using python-pptx
Constructs 16:9 widescreen, professionally styled presentation decks.
"""
import os
from typing import List, Dict, Any
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

# ── Design Palette ──────────────────────────────────────────────────────────
COLOR_PRIMARY = RGBColor(11, 37, 69)      # Deep Navy
COLOR_SECONDARY = RGBColor(19, 64, 116)  # Accent Royal Blue
COLOR_ACCENT = RGBColor(37, 99, 235)     # Vivid Blue
COLOR_MUTED = RGBColor(100, 116, 139)    # Slate Gray
COLOR_BG_CARD = RGBColor(241, 245, 249)  # Soft Light Slate
COLOR_WHITE = RGBColor(255, 255, 255)

def create_presentation_file(slides_data: List[Dict[str, Any]], output_path: str, title: str = "Meeting Presentation") -> str:
    """Builds a polished 16:9 widescreen presentation from structured slide data."""
    prs = Presentation()
    # Configure 16:9 Widescreen aspect ratio (13.33 x 7.5 inches)
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    blank_layout = prs.slide_layouts[6] # Blank canvas layout

    for i, slide_info in enumerate(slides_data):
        slide = prs.slides.add_slide(blank_layout)
        slide_title = slide_info.get("title", f"Slide {i + 1}")
        slide_content = slide_info.get("content", [])
        slide_type = slide_info.get("type", "content")

        # Top Accent Header Bar
        header_bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(0.15))
        header_bar.fill.solid()
        header_bar.fill.fore_color.rgb = COLOR_ACCENT
        header_bar.line.color.rgb = COLOR_ACCENT

        if slide_type == "title" or i == 0:
            # ── Title Slide Layout ──
            # Centered Card Container
            card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.5), Inches(1.8), Inches(10.333), Inches(3.8))
            card.fill.solid()
            card.fill.fore_color.rgb = COLOR_BG_CARD
            card.line.color.rgb = RGBColor(226, 232, 240)

            # Title Text
            tx_box = slide.shapes.add_textbox(Inches(2.0), Inches(2.2), Inches(9.333), Inches(1.6))
            tf = tx_box.text_frame
            tf.word_wrap = True
            p = tf.paragraphs[0]
            p.text = slide_title
            p.font.name = "Calibri"
            p.font.size = Pt(40)
            p.font.bold = True
            p.font.color.rgb = COLOR_PRIMARY
            p.alignment = PP_ALIGN.CENTER

            # Subtitle
            sub_box = slide.shapes.add_textbox(Inches(2.0), Inches(4.0), Inches(9.333), Inches(1.0))
            sub_tf = sub_box.text_frame
            sub_tf.word_wrap = True
            sub_p = sub_tf.paragraphs[0]
            sub_p.text = slide_info.get("subtitle", "AI-Powered Meeting Intelligence & Action Deck")
            sub_p.font.name = "Calibri"
            sub_p.font.size = Pt(20)
            sub_p.font.color.rgb = COLOR_MUTED
            sub_p.alignment = PP_ALIGN.CENTER

        else:
            # ── Standard Content Slide Layout ──
            # Header Title Box
            title_box = slide.shapes.add_textbox(Inches(1.0), Inches(0.6), Inches(11.333), Inches(1.0))
            tf_title = title_box.text_frame
            tf_title.word_wrap = True
            p_title = tf_title.paragraphs[0]
            p_title.text = slide_title
            p_title.font.name = "Calibri"
            p_title.font.size = Pt(28)
            p_title.font.bold = True
            p_title.font.color.rgb = COLOR_PRIMARY

            # Underline bar
            line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(1.0), Inches(1.65), Inches(3.0), Inches(0.04))
            line.fill.solid()
            line.fill.fore_color.rgb = COLOR_ACCENT
            line.line.color.rgb = COLOR_ACCENT

            # Content Bullet Box
            content_box = slide.shapes.add_textbox(Inches(1.0), Inches(2.0), Inches(11.333), Inches(4.6))
            tf_content = content_box.text_frame
            tf_content.word_wrap = True

            bullets = slide_content if isinstance(slide_content, list) else [str(slide_content)]
            for b_idx, bullet in enumerate(bullets):
                p_bullet = tf_content.add_paragraph() if b_idx > 0 else tf_content.paragraphs[0]
                p_bullet.text = f"•  {bullet}"
                p_bullet.font.name = "Calibri"
                p_bullet.font.size = Pt(18)
                p_bullet.font.color.rgb = RGBColor(30, 41, 59)
                p_bullet.space_after = Pt(14)

        # Footer Slide Number
        footer_box = slide.shapes.add_textbox(Inches(11.0), Inches(6.9), Inches(1.8), Inches(0.4))
        p_foot = footer_box.text_frame.paragraphs[0]
        p_foot.text = f"Slide {i + 1} of {len(slides_data)}"
        p_foot.font.name = "Calibri"
        p_foot.font.size = Pt(11)
        p_foot.font.color.rgb = COLOR_MUTED
        p_foot.alignment = PP_ALIGN.RIGHT

    # Ensure output directory exists and save file
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    prs.save(output_path)
    print(f"[PPTX] Presentation saved successfully: {output_path}")
    return output_path
