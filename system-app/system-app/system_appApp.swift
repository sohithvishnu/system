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
    let persistenceController = PersistenceController.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(\.managedObjectContext, persistenceController.container.viewContext)
        }
    }
}
