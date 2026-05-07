//
//  System_appApp.swift
//  System-app
//
//  Created by Advanced Intelligence Research on 05.05.2026.
//
import SwiftUI
import CoreData

@main
struct System_appApp: App {
    @StateObject private var authManager = AuthManager()
    
    var body: some Scene {
        WindowGroup {
            Group {
                if authManager.isAuthenticatied {
                    SettingsView()
                        .environmentObject(authManager)
                } else {
                    LoginView()
                        .environmentObject(authManager)
                }
            }
            .onAppear {
                configureMacAppearance()  // ← called here, scene is ready
            }
        }
    }
    
    func configureMacAppearance() {
        #if targetEnvironment(macCatalyst)
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene else { return }
        
        scene.title = "System"
        
        if let titlebar = scene.titlebar {
            titlebar.titleVisibility = .hidden
            titlebar.toolbar = nil
        }
        
        scene.windows.first?.backgroundColor = .black
        #endif
    }
}
