//
//  AppTheme.swift
//  System-app
//
//  Created by Advanced Intelligence Research on 06.05.2026.
//


import SwiftUI

import SwiftUI

struct AppTheme {
    // Colors based on your image
    static let background = Color(red: 0.05, green: 0.05, blue: 0.05) // Deepest charcoal/black
    static let sidebarBackground = Color(red: 0.07, green: 0.07, blue: 0.07)
    static let cardBackground = Color(red: 0.09, green: 0.09, blue: 0.09)
    
    static let textPrimary = Color.white
    static let textSecondary = Color(white: 0.5) // Muted gray
    
    static let accentGreen = Color(red: 0.0, green: 0.8, blue: 0.3) // Bright terminal green
    static let accentRed = Color(red: 0.9, green: 0.2, blue: 0.3)
    
    static let neonGreen = Color(red: 0.0, green: 0.9, blue: 0.3)
    static let fieldBackground = Color(white: 0.08)
    // Global Font Modifier for that "hacker/developer" aesthetic
    static func font(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        return Font.system(size: size, weight: weight, design: .monospaced)
    }
}
