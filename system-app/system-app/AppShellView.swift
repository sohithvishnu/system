//
//  AppShellView.swift
//  System-app
//
//  Created by Advanced Intelligence Research on 06.05.2026.
//

import SwiftUI

struct SidebarIcon: View {
    let icon: String
    let isActive: Bool
    
    var body: some View {
        Image(systemName: icon)
            .font(.system(size: 20, weight: isActive ? .bold : .regular))
            .foregroundStyle(isActive ? AppTheme.textPrimary : AppTheme.textSecondary)
    }
}
            

struct AppShellView<Content: View>: View {
    let content: Content
    
    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    var body: some View {
        HStack(spacing:0) {
            VStack(spacing:30) {
                Spacer().frame(height: 20)
                
                SidebarIcon(icon: "terminal", isActive: false)
                SidebarIcon(icon: "clock", isActive: false)
                SidebarIcon(icon: "square.grid.2x2", isActive: false)
                SidebarIcon(icon: "bolt", isActive: false)
                SidebarIcon(icon: "book", isActive: false)
                SidebarIcon(icon: "cpu", isActive: false)
                SidebarIcon(icon: "folder", isActive: false)
                SidebarIcon(icon: "network", isActive: false)
                SidebarIcon(icon: "person", isActive: true) // Profile is active
                SidebarIcon(icon: "gearshape", isActive: false)
                
                Spacer()
                
                
            }
            .frame(width: 70)
            .background(AppTheme.sidebarBackground)
            
            ZStack(alignment: .topLeading) {
                AppTheme.background.ignoresSafeArea()
                
                content
                    .padding(40)
            }
            .ignoresSafeArea()
            .preferredColorScheme(.dark)
        }
    }
}
